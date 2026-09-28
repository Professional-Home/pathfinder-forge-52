"""YOLO colony detector wrapper with safe model verification and annotation."""

import io
import logging
import os
import time
from pathlib import Path
from typing import Any, BinaryIO, List, Optional, Tuple, Union

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.schemas import ColonyDetection, ColonyQualityAssessment

logger = logging.getLogger("colony_detector")

# Maximum source dimension for input images before normalization (PRF-01)
# High-resolution mobile phone and lab camera captures (e.g. 6000x4000, 8000x6000) produce excessive
# uncompressed raster memory (e.g. 144 MB for 48 MP) without improving YOLO11n detection accuracy,
# since YOLO operates at imgsz=640.
# A maximum dimension of 2048 px provides 3.2x oversampling relative to YOLO's 640 receptive field,
# preserves fine punctate colony morphology (sub-millimeter colonies on a 90mm plate have >10px diameter),
# matches 2K Retina display resolution for browser review,
# and caps uncompressed RGB bitmap RAM to ~12.5 MB.
DEFAULT_MAX_SOURCE_DIMENSION = 2048
MAX_SOURCE_DIMENSION = int(os.getenv("COLONY_MAX_IMAGE_DIMENSION", str(DEFAULT_MAX_SOURCE_DIMENSION)))

# Extreme dimension ceiling for decompression bomb prevention (PRF-01)
# Images exceeding 10,000 px in either axis are rejected before full raster allocation.
MAX_ALLOWED_RAW_DIMENSION = int(os.getenv("COLONY_MAX_RAW_DIMENSION", "10000"))


class DetectionResult(tuple):
    """5-tuple compatible return object enriched with source resolution metadata (PRF-01).

    Unpacks identically as (detections, width, height, elapsed_ms, annotated_image)
    for 100% backward compatibility, while exposing original resolution attributes.
    """

    def __new__(
        cls,
        detections: List[ColonyDetection],
        width: int,
        height: int,
        latency_ms: int,
        annotated_image: Image.Image,
        original_width: Optional[int] = None,
        original_height: Optional[int] = None,
        was_downscaled: bool = False,
    ):
        return super().__new__(
            cls, (detections, width, height, latency_ms, annotated_image)
        )

    def __init__(
        self,
        detections: List[ColonyDetection],
        width: int,
        height: int,
        latency_ms: int,
        annotated_image: Image.Image,
        original_width: Optional[int] = None,
        original_height: Optional[int] = None,
        was_downscaled: bool = False,
    ):
        self.original_width = original_width or width
        self.original_height = original_height or height
        self.was_downscaled = was_downscaled


def preprocess_specimen_image(
    image: Image.Image,
    max_dimension: int = MAX_SOURCE_DIMENSION,
) -> Tuple[Image.Image, int, int, bool]:
    """Normalizes high-resolution specimen images to safe operational dimensions (PRF-01).

    1. Preserves EXIF orientation so rotated mobile camera images are upright.
    2. Converts to standard RGB color space.
    3. If dimensions exceed max_dimension, downscales using high-fidelity LANCZOS resampling,
       preserving the original aspect ratio.
    4. If dimensions are already within max_dimension, leaves the image unchanged (never upscales).

    Returns:
        Tuple of (processed_image, raw_width, raw_height, was_downscaled)
    """
    # 1. Honor EXIF orientation tag if present (crucial for mobile camera captures)
    try:
        transposed = ImageOps.exif_transpose(image)
        if transposed is not None:
            image = transposed
    except Exception as e:
        logger.warning(f"Could not apply EXIF orientation transpose: {e}")

    # 2. Normalize color mode to RGB
    if image.mode != "RGB":
        image = image.convert("RGB")

    raw_width, raw_height = image.size

    # 3. Only downscale if image exceeds max_dimension; never upscale small images
    if max(raw_width, raw_height) > max_dimension:
        scale = max_dimension / max(raw_width, raw_height)
        target_w = max(1, round(raw_width * scale))
        target_h = max(1, round(raw_height * scale))
        logger.info(
            f"[Preprocessing] Downscaling high-resolution input from {raw_width}x{raw_height} "
            f"to {target_w}x{target_h} (max_dim={max_dimension}, scale={scale:.4f})"
        )
        normalized_image = image.resize((target_w, target_h), resample=Image.Resampling.LANCZOS)
        return normalized_image, raw_width, raw_height, True

    return image, raw_width, raw_height, False


class ModelNotConfiguredError(Exception):
    """Raised when YOLO colony detection is requested but no trained model weights exist."""


class ColonyDetector:
    """Manages YOLO colony detection model lifecycle and specimen inference."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        max_dimension: int = MAX_SOURCE_DIMENSION,
        max_raw_dimension: int = MAX_ALLOWED_RAW_DIMENSION,
    ):
        raw_path = model_path or os.getenv("COLONY_MODEL_PATH", "models/best.pt")
        self.model_path = Path(raw_path)
        self.max_dimension = max_dimension
        self.max_raw_dimension = max_raw_dimension

        # Resolve relative to project root or current working dir if relative
        if not self.model_path.is_absolute():
            base_dir = Path(__file__).resolve().parent.parent
            self.resolved_path = (base_dir / self.model_path).resolve()
        else:
            self.resolved_path = self.model_path

        self.model = None
        self.is_loaded = False
        self._load_model()

    def _load_model(self) -> None:
        """Verifies configured weights file existence and attempts to load the YOLO model."""
        if not self.resolved_path.exists():
            logger.warning(
                f"[Model Config] Colony model file not found at: {self.resolved_path}. "
                f"The service will run in configuration-pending mode until 'best.pt' is provided."
            )
            self.model = None
            self.is_loaded = False
            return

        try:
            logger.info(f"[Model Config] Loading trained YOLO model from {self.resolved_path}...")
            # Lazy import ultralytics to allow lightweight imports if needed
            from ultralytics import YOLO

            self.model = YOLO(str(self.resolved_path))
            self.is_loaded = True
            logger.info("[Model Config] Trained YOLO model loaded successfully.")
        except Exception as e:
            logger.error(f"[Model Config] Failed to load model weights from {self.resolved_path}: {e}")
            self.model = None
            self.is_loaded = False

    def is_ready(self) -> bool:
        """Returns True if a valid trained model is loaded and ready for inference."""
        return self.is_loaded and self.model is not None

    def detect(
        self,
        image_input: Optional[Union[bytes, BinaryIO, Any]] = None,
        confidence_threshold: float = 0.30,
        image_bytes: Optional[bytes] = None,
    ) -> DetectionResult:
        """Runs colony detection and returns bounding boxes, dimensions, latency, and annotated image.

        Supports both raw image bytes and binary file streams (e.g. SpooledTemporaryFile)
        to prevent unnecessary memory buffering of large uploads (REL-03).
        Safely normalizes high-resolution source dimensions before YOLO inference (PRF-01).

        Raises:
            ModelNotConfiguredError: If no trained model is available.
            ValueError: If image decoding fails or dimensions exceed decompression ceiling.
        """
        if not self.is_ready():
            raise ModelNotConfiguredError(
                f"Trained colony detection model is not configured or not found at '{self.model_path}'. "
                f"Please provide the trained 'best.pt' weights in the models directory to enable inference."
            )

        # 1. Decode specimen image safely with Pillow
        raw_source = image_input if image_input is not None else image_bytes
        if raw_source is None:
            raise ValueError("No image data provided for colony detection.")

        try:
            if isinstance(raw_source, (bytes, bytearray)):
                raw_image = Image.open(io.BytesIO(raw_source))
            else:
                if hasattr(raw_source, "seek"):
                    raw_source.seek(0)
                raw_image = Image.open(raw_source)

            # Check raw header dimensions before raster allocation (defense against decompression bombs)
            raw_w, raw_h = raw_image.size
            if max(raw_w, raw_h) > self.max_raw_dimension:
                raise ValueError(
                    f"Image dimensions ({raw_w}x{raw_h}) exceed maximum allowed dimension of {self.max_raw_dimension}px."
                )

            # Preprocess: EXIF orientation, RGB normalization, and high-res downscaling (PRF-01)
            image, orig_width, orig_height, was_downscaled = preprocess_specimen_image(
                raw_image,
                max_dimension=self.max_dimension,
            )
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Failed to decode image data: {e}") from e

        processed_width, processed_height = image.size
        logger.info(
            f"[Inference] Processing specimen image ({processed_width}x{processed_height}px) with conf={confidence_threshold}"
        )

        start_time = time.perf_counter()

        # 2. Run real YOLO inference with locked imgsz=640 invariant
        try:
            results = self.model.predict(
                source=image,
                conf=confidence_threshold,
                imgsz=640,
                verbose=False,
            )
        except Exception as e:
            logger.error(f"[Inference Error] YOLO execution failed: {e}")
            raise RuntimeError(f"Model inference failed: {e}") from e

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # 3. Parse detections
        detections: List[ColonyDetection] = []
        if results and len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0]) if box.conf is not None else 0.0
                cls_id = int(box.cls[0]) if box.cls is not None else 0

                # Single-class colony detector specification
                detections.append(
                    ColonyDetection(
                        x1=round(float(xyxy[0]), 1),
                        y1=round(float(xyxy[1]), 1),
                        x2=round(float(xyxy[2]), 1),
                        y2=round(float(xyxy[3]), 1),
                        confidence=round(conf, 4),
                        class_id=cls_id,
                        class_name="colony",
                    )
                )

        logger.info(
            f"[Inference] Finished in {elapsed_ms}ms. Detected {len(detections)} colonies above cutoff."
        )

        # 4. Generate annotated image using Pillow
        annotated_image = self._render_annotation(image, detections)

        return DetectionResult(
            detections=detections,
            width=processed_width,
            height=processed_height,
            latency_ms=elapsed_ms,
            annotated_image=annotated_image,
            original_width=orig_width,
            original_height=orig_height,
            was_downscaled=was_downscaled,
        )

    def _render_annotation(
        self, image: Image.Image, detections: List[ColonyDetection]
    ) -> Image.Image:
        """Renders bounding boxes and confidence tags directly onto a copy of the image."""
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)

        img_width, _ = annotated.size
        stroke_width = max(2, round(img_width / 400))
        font_size = max(11, round(img_width / 70))

        try:
            font = ImageFont.load_default(size=font_size)
        except TypeError:
            # Fallback for older Pillow versions
            font = ImageFont.load_default()

        box_color = (16, 185, 129)  # Emerald green (matches frontend researcher accent)
        text_bg_color = (16, 185, 129)
        text_color = (255, 255, 255)

        for det in detections:
            # Bounding box
            draw.rectangle(
                [det.x1, det.y1, det.x2, det.y2],
                outline=box_color,
                width=stroke_width,
            )

            # Confidence tag
            label_text = f"colony {int(det.confidence * 100)}%"
            text_bbox = draw.textbbox((0, 0), label_text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]

            label_x1 = det.x1
            label_y1 = max(0, det.y1 - text_height - 6)
            label_x2 = label_x1 + text_width + 8
            label_y2 = label_y1 + text_height + 6

            draw.rectangle([label_x1, label_y1, label_x2, label_y2], fill=text_bg_color)
            draw.text((label_x1 + 4, label_y1 + 3), label_text, fill=text_color, font=font)

        return annotated


def assess_colony_quality(detections: List[ColonyDetection]) -> ColonyQualityAssessment:
    """Computes transparent, deterministic plate density and crowding reliability indicators.

    Project-specific operational thresholds:
    - Low: <50 colonies
    - Medium: 50-200 colonies
    - High: 201-400 colonies (Review recommended: elevated crowding risk)
    - Ultra-High: >400 colonies (Review strongly recommended: confluence / overlap risk)
    """
    count = len(detections)
    if count == 0:
        return ColonyQualityAssessment(
            density_level="low",
            review_recommended=False,
            warning_message=None,
            confluence_risk="low",
            overlap_ratio=0.0,
            reason="No colonies identified in specimen image.",
        )

    # Compute pairwise spatial overlap across detected colony bounding boxes
    overlap_count = 0
    if count > 1:
        for i in range(count):
            d1 = detections[i]
            area1 = max(0.0, d1.x2 - d1.x1) * max(0.0, d1.y2 - d1.y1)
            is_overlapping = False
            for j in range(count):
                if i == j:
                    continue
                d2 = detections[j]
                xx1 = max(d1.x1, d2.x1)
                yy1 = max(d1.y1, d2.y1)
                xx2 = min(d1.x2, d2.x2)
                yy2 = min(d1.y2, d2.y2)
                w = max(0.0, xx2 - xx1)
                h = max(0.0, yy2 - yy1)
                inter = w * h
                if inter > 0:
                    area2 = max(0.0, d2.x2 - d2.x1) * max(0.0, d2.y2 - d2.y1)
                    union = area1 + area2 - inter
                    iou = inter / max(union, 1e-6)
                    # IoU > 0.10 indicates touching/overlapping colony boundaries
                    if iou > 0.10:
                        is_overlapping = True
                        break
            if is_overlapping:
                overlap_count += 1
        overlap_ratio = round(overlap_count / count, 3)
    else:
        overlap_ratio = 0.0

    # Deterministic confluence / crowding risk indicator
    if overlap_ratio >= 0.40 or (count > 100 and overlap_ratio >= 0.25):
        confluence_risk = "high"
    elif overlap_ratio >= 0.15 or (count > 50 and overlap_ratio >= 0.10):
        confluence_risk = "medium"
    else:
        confluence_risk = "low"

    # Project-specific operational density tier & warning
    if count > 400:
        density_level = "ultra_high"
        review_recommended = True
        warning_message = (
            "Very high-density plate detected. Individual colonies may overlap or form confluent regions. "
            "Manual verification is strongly recommended."
        )
        reason = f"Predicted colony count ({count}) exceeds ultra-high density cutoff (>400)."
    elif count > 200:
        density_level = "high"
        review_recommended = True
        warning_message = (
            "High-density plate detected. Automated count may be less reliable in crowded colony regions. "
            "Manual verification is recommended."
        )
        reason = f"Predicted colony count ({count}) exceeds high-density cutoff (>200)."
    elif count >= 50:
        density_level = "medium"
        if confluence_risk == "high":
            review_recommended = True
            warning_message = (
                "Elevated colony crowding detected. Overlapping colony clusters may affect individual count precision. "
                "Visual verification recommended."
            )
            reason = f"Medium density ({count}) with elevated colony overlap ratio ({overlap_ratio:.1%})."
        else:
            review_recommended = False
            warning_message = None
            reason = f"Plate count ({count}) is within standard operating range (50-200)."
    else:
        density_level = "low"
        review_recommended = False
        warning_message = None
        reason = f"Plate count ({count}) is within low-density operating range (<50)."

    return ColonyQualityAssessment(
        density_level=density_level,
        review_recommended=review_recommended,
        warning_message=warning_message,
        confluence_risk=confluence_risk,
        overlap_ratio=overlap_ratio,
        reason=reason,
    )
