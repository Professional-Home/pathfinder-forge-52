"""YOLO colony detector wrapper with safe model verification and annotation."""

import io
import logging
import os
import time
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from app.schemas import ColonyDetection

logger = logging.getLogger("colony_detector")


class ModelNotConfiguredError(Exception):
    """Raised when YOLO colony detection is requested but no trained model weights exist."""


class ColonyDetector:
    """Manages YOLO colony detection model lifecycle and specimen inference."""

    def __init__(self, model_path: Optional[str] = None):
        raw_path = model_path or os.getenv("COLONY_MODEL_PATH", "models/best.pt")
        self.model_path = Path(raw_path)

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
        image_bytes: bytes,
        confidence_threshold: float = 0.30,
    ) -> Tuple[List[ColonyDetection], int, int, int, Image.Image]:
        """Runs colony detection and returns bounding boxes, dimensions, latency, and annotated image.

        Raises:
            ModelNotConfiguredError: If no trained model is available.
            ValueError: If image decoding fails.
        """
        if not self.is_ready():
            raise ModelNotConfiguredError(
                f"Trained colony detection model is not configured or not found at '{self.model_path}'. "
                f"Please provide the trained 'best.pt' weights in the models directory to enable inference."
            )

        # 1. Decode specimen image safely with Pillow
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Normalize to standard RGB (handles CMYK, RGBA, Grayscale, etc.)
            image = image.convert("RGB")
        except Exception as e:
            raise ValueError(f"Failed to decode image data: {e}") from e

        orig_width, orig_height = image.size
        logger.info(
            f"[Inference] Processing specimen image ({orig_width}x{orig_height}px) with conf={confidence_threshold}"
        )

        start_time = time.perf_counter()

        # 2. Run real YOLO inference
        try:
            results = self.model.predict(
                source=image,
                conf=confidence_threshold,
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

        return detections, orig_width, orig_height, elapsed_ms, annotated_image

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
