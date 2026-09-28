"""FastAPI Application for AI-Based Petri Dish Colony Counting Tool."""

import asyncio
import logging
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from app.detector import ColonyDetector, ModelNotConfiguredError, assess_colony_quality
from app.schemas import (
    ColonyDetectionErrorResponse,
    ColonyDetectionSuccessResponse,
    ColonyErrorDetail,
    ColonyImageMetadata,
    HealthResponse,
)

# Load local .env if available
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("colony_api")

# Directories
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Upload & Streaming Limits
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB limit
CHUNK_SIZE_BYTES = 64 * 1024  # 64 KB upload chunk
ALLOWED_MIME_PREFIXES = ("image/",)

# Retention policy configuration (P0-2)
MAX_OUTPUT_AGE_SECONDS = int(os.getenv("MAX_OUTPUT_AGE_SECONDS", "3600"))  # Default 1 hour
MAX_OUTPUT_FILES = int(os.getenv("MAX_OUTPUT_FILES", "500"))  # Default at most 500 files


def prune_output_artifacts(
    outputs_dir: Path,
    max_age_seconds: int,
    max_files: int,
    preserve_filename: Optional[str] = None,
) -> None:
    """Safely prunes older annotated JPEG artifacts from outputs_dir to prevent unbounded disk growth.

    Never deletes files outside outputs_dir, never deletes non-annotated files,
    and preserves the newly created artifact from the active request.
    """
    try:
        if not outputs_dir.exists() or not outputs_dir.is_dir():
            return

        now = time.time()
        surviving = []

        # Find only annotated JPEG files directly inside outputs_dir
        for item in outputs_dir.glob("annotated_*.jpg"):
            if not item.is_file() or item.name == preserve_filename:
                continue
            try:
                mtime = item.stat().st_mtime
                if now - mtime > max_age_seconds:
                    item.unlink(missing_ok=True)
                    logger.debug(f"Evicted expired artifact: {item.name}")
                else:
                    surviving.append((mtime, item))
            except OSError as e:
                logger.warning(f"Failed to inspect or evict output file {item.name}: {e}")

        # Enforce max file count by evicting oldest surviving artifacts
        if len(surviving) > max_files:
            surviving.sort(key=lambda x: x[0])  # Oldest first
            excess_count = len(surviving) - max_files
            for _, path in surviving[:excess_count]:
                try:
                    path.unlink(missing_ok=True)
                    logger.debug(f"Evicted excess artifact: {path.name}")
                except OSError as e:
                    logger.warning(f"Failed to evict excess output file {path.name}: {e}")
    except Exception as e:
        logger.warning(f"Unexpected error during output directory pruning: {e}")


# Detector instance (singleton)
detector: Optional[ColonyDetector] = None

# Concurrency limit for CPU-bound YOLO inference (REL-01)
MAX_CONCURRENT_INFERENCES = 2
_inference_semaphore: Optional[asyncio.Semaphore] = None
_semaphore_loop: Optional[asyncio.AbstractEventLoop] = None


def get_inference_semaphore() -> asyncio.Semaphore:
    """Returns the singleton asyncio.Semaphore for throttling concurrent YOLO inferences to max 2 (REL-01)."""
    global _inference_semaphore, _semaphore_loop
    current_loop = asyncio.get_running_loop()
    if _inference_semaphore is None or _semaphore_loop != current_loop:
        _inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT_INFERENCES)
        _semaphore_loop = current_loop
    return _inference_semaphore


def sanitize_model_path_for_health(path: Optional[Path | str]) -> Optional[str]:
    """Sanitizes model path to return a safe relative model identifier without exposing server filesystem hierarchy (SEC-01)."""
    if not path:
        return None
    p = Path(path)
    filename = p.name or "best.pt"
    parent_name = p.parent.name
    if parent_name and parent_name.lower() in ("models", "weights", "checkpoints"):
        return f"{parent_name}/{filename}"
    return f"models/{filename}"


def get_upload_file_size(upload_file: UploadFile) -> int:
    """Determines the exact byte size of an UploadFile without loading it into heap memory.

    Uses upload_file.size attribute if present, or queries the underlying spooled file pointer.
    Guarantees the file read pointer is restored to offset 0.
    """
    size = getattr(upload_file, "size", None)
    if isinstance(size, int) and size >= 0:
        if upload_file.file is not None and hasattr(upload_file.file, "seek"):
            try:
                upload_file.file.seek(0)
            except Exception:
                pass
        return size

    if upload_file.file is not None and hasattr(upload_file.file, "seek") and hasattr(upload_file.file, "tell"):
        try:
            upload_file.file.seek(0, os.SEEK_END)
            total = upload_file.file.tell()
            upload_file.file.seek(0, os.SEEK_SET)
            return total
        except Exception as e:
            logger.warning(f"Could not determine upload file size via seek/tell: {e}")

    return 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes the ColonyDetector on application startup."""
    global detector
    model_path = os.getenv("COLONY_MODEL_PATH", "models/best.pt")
    logger.info(f"Starting Colony Detector microservice. Model path configured as: {model_path}")
    detector = ColonyDetector(model_path=model_path)
    yield
    logger.info("Colony Detector microservice shutting down.")


app = FastAPI(
    title="Micrylis Colony Detector API",
    description="Microservice providing automated Petri-dish colony quantification using YOLO object detection.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS Configuration ────────────────────────────────────────────────────────


def get_cors_origins() -> List[str]:
    """Resolves allowed CORS origins based on environment and explicit configuration (DEP-02).

    In development, defaults to standard local dev ports (8080, 5173, 3000) if not set.
    In production, strictly requires explicit FRONTEND_ORIGIN configuration and disallows
    silent localhost fallback and wildcard '*' origins with credentials.
    """
    env_mode = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", os.getenv("NODE_ENV", "development"))).lower()
    is_production = env_mode in ("production", "prod")

    raw_origins = os.getenv("FRONTEND_ORIGIN", "")
    explicit_origins = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

    if is_production:
        production_origins = [orig for orig in explicit_origins if orig != "*"]
        if not production_origins:
            logger.warning(
                "FRONTEND_ORIGIN is not configured in production environment. "
                "Cross-origin requests from web browsers will be rejected."
            )
        return production_origins

    if explicit_origins:
        return explicit_origins
    return ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"]


allowed_origins = get_cors_origins()
logger.info(f"Configuring CORS for allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Error Handling Helper ─────────────────────────────────────────────────────


def make_error_response(status_code: int, code: str, message: str, details: Optional[object] = None):
    """Creates a structured JSON error response matching frontend ColonyDetectionErrorResponse."""
    payload = ColonyDetectionErrorResponse(
        success=False,
        error=ColonyErrorDetail(code=code, message=message, details=details),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = f"HTTP_{exc.status_code}"
    return make_error_response(exc.status_code, code, str(exc.detail))


from fastapi.exceptions import RequestValidationError


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return make_error_response(
        status.HTTP_400_BAD_REQUEST,
        "INVALID_REQUEST",
        "Invalid request parameters or missing required fields.",
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception: {exc}", exc_info=True)
    return make_error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "An unexpected error occurred processing the colony detection request.",
    )


# ─── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint reporting API status and model availability."""
    model_loaded = detector.is_ready() if detector else False
    raw_path = detector.model_path if detector else None
    model_path = sanitize_model_path_for_health(raw_path)

    return HealthResponse(
        status="ok",
        model_loaded=model_loaded,
        model_path=model_path,
    )


ARTIFACT_FILENAME_REGEX = re.compile(r"^annotated_[a-f0-9]{12,64}\.jpg$")


@app.get(
    "/outputs/{filename}",
    response_class=FileResponse,
    responses={
        200: {"content": {"image/jpeg": {}}, "description": "Annotated specimen visualization artifact"},
        404: {"model": ColonyDetectionErrorResponse, "description": "Artifact not found, expired, or invalid"},
    },
    tags=["Artifacts"],
)
async def get_output_artifact(filename: str):
    """Serves generated annotated colony specimen artifacts securely (SEC-02).

    Validates artifact filename structure, strictly disallows directory traversal,
    and returns 404 for non-existent, expired, or invalid artifact requests.
    """
    # 1. Strict regex validation disallowing path traversal (../, ..\, null bytes, non-annotated files)
    if not ARTIFACT_FILENAME_REGEX.match(filename):
        return make_error_response(
            status.HTTP_404_NOT_FOUND,
            "ARTIFACT_NOT_FOUND",
            "Artifact not found or invalid artifact identifier.",
        )

    # 2. Strict path containment verification
    target_path = (OUTPUTS_DIR / filename).resolve()
    outputs_dir_resolved = OUTPUTS_DIR.resolve()

    try:
        if target_path.parent != outputs_dir_resolved or not target_path.is_file():
            return make_error_response(
                status.HTTP_404_NOT_FOUND,
                "ARTIFACT_NOT_FOUND",
                "Artifact not found or has expired.",
            )
    except Exception:
        return make_error_response(
            status.HTTP_404_NOT_FOUND,
            "ARTIFACT_NOT_FOUND",
            "Artifact not found.",
        )

    return FileResponse(
        path=target_path,
        media_type="image/jpeg",
        filename=filename,
        headers={
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.post(
    "/api/v1/detect-colonies",
    response_model=ColonyDetectionSuccessResponse,
    responses={
        400: {"model": ColonyDetectionErrorResponse},
        413: {"model": ColonyDetectionErrorResponse},
        499: {"model": ColonyDetectionErrorResponse},
        503: {"model": ColonyDetectionErrorResponse},
    },
    tags=["Inference"],
)
async def detect_colonies(
    request: Request,
    image: UploadFile = File(..., description="Uploaded Petri dish image file (Max 5 MB)"),
    confidence_threshold: Optional[float] = Form(
        0.30, description="Confidence cutoff score between 0.20 and 0.90"
    ),
):
    """Analyzes an uploaded Petri-dish specimen image and returns colony bounding boxes and count."""
    try:
        # 1. Validate confidence threshold bounds
        if confidence_threshold is None or not (0.20 <= confidence_threshold <= 0.90):
            return make_error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_CONFIDENCE_THRESHOLD",
                "Confidence threshold must be a number between 0.20 and 0.90.",
            )

        # 2. Validate MIME type
        content_type = (image.content_type or "").lower()
        if not any(content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
            logger.warning(f"Rejected non-image upload with content-type: {content_type}")
            return make_error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_IMAGE",
                "The uploaded file is not a recognized image format. Please upload a JPEG, PNG, or WEBP photo.",
            )

        # 3. Size validation & empty check without buffering into heap RAM (REL-03)
        file_size = get_upload_file_size(image)

        if file_size > MAX_IMAGE_SIZE_BYTES:
            size_mb = round(file_size / (1024 * 1024), 2)
            return make_error_response(
                status.HTTP_413_CONTENT_TOO_LARGE
                if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE")
                else 413,
                "IMAGE_TOO_LARGE",
                f"Image size ({size_mb} MB) exceeds maximum allowed limit of 5 MB.",
            )

        if file_size == 0:
            return make_error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_IMAGE",
                "Uploaded file is empty.",
            )

        # 4. Check model configuration readiness
        if not detector or not detector.is_ready():
            logger.error("Colony detection requested but model weights (best.pt) are not loaded.")
            return make_error_response(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "MODEL_NOT_CONFIGURED",
                "The trained colony detection model (best.pt) is not configured or not found. "
                "Please install the trained model weights into the models directory to enable inference.",
            )

        # 5. Check if client disconnected before acquiring inference semaphore (REL-02)
        if await request.is_disconnected():
            logger.warning("Client disconnected prior to acquiring inference semaphore; aborting.")
            return make_error_response(
                499,
                "CLIENT_CLOSED_REQUEST",
                "Client disconnected before inference could start.",
            )

        # 6. Execute detection inference with concurrency limit of 2 (REL-01)
        inference_semaphore = get_inference_semaphore()
        async with inference_semaphore:
            # Re-check client disconnect after acquiring semaphore in case request queued (REL-02)
            if await request.is_disconnected():
                logger.warning("Client disconnected while waiting for inference semaphore; aborting.")
                return make_error_response(
                    499,
                    "CLIENT_CLOSED_REQUEST",
                    "Client disconnected before inference could start.",
                )

            try:
                # Pass spooled temporary file directly to avoid allocating in-memory byte buffers (REL-03)
                # and apply safe high-resolution input normalization (PRF-01)
                detection_result = await run_in_threadpool(
                    detector.detect,
                    image_input=image.file,
                    confidence_threshold=confidence_threshold,
                )
                detections, width, height, latency_ms, annotated_image = detection_result
                original_width = getattr(detection_result, "original_width", width)
                original_height = getattr(detection_result, "original_height", height)
                was_downscaled = getattr(detection_result, "was_downscaled", False)
            except ModelNotConfiguredError as e:
                return make_error_response(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "MODEL_NOT_CONFIGURED",
                    str(e),
                )
            except ValueError as e:
                return make_error_response(
                    status.HTTP_400_BAD_REQUEST,
                    "INVALID_IMAGE",
                    f"Unable to process image data: {e}",
                )
            except Exception as e:
                logger.error(f"Detection execution failed: {e}", exc_info=True)
                return make_error_response(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "INFERENCE_ERROR",
                    "An error occurred during colony model inference.",
                )

        # 7. Save annotated image visualization artifact
        annotated_filename = f"annotated_{uuid.uuid4().hex}.jpg"
        annotated_filepath = OUTPUTS_DIR / annotated_filename
        try:
            annotated_image.save(annotated_filepath, format="JPEG", quality=90)
        except Exception as e:
            logger.warning(f"Could not write annotated image artifact: {e}")

        # Prune older outputs in worker threadpool to prevent unbounded storage growth (P0-2)
        try:
            await run_in_threadpool(
                prune_output_artifacts,
                outputs_dir=OUTPUTS_DIR,
                max_age_seconds=MAX_OUTPUT_AGE_SECONDS,
                max_files=MAX_OUTPUT_FILES,
                preserve_filename=annotated_filename,
            )
        except Exception as e:
            logger.warning(f"Artifact retention pruning failed: {e}")

        # Build public URL for annotated image
        public_base = os.getenv("PUBLIC_BASE_URL", str(request.base_url).rstrip("/"))
        annotated_url = f"{public_base}/outputs/{annotated_filename}"

        # 8. Assess colony plate density, crowding, and review indicators
        quality_assessment = assess_colony_quality(detections)

        # 9. Construct and return validated response
        response_payload = ColonyDetectionSuccessResponse(
            success=True,
            count=len(detections),
            detections=detections,
            image=ColonyImageMetadata(
                width=width,
                height=height,
                original_width=original_width,
                original_height=original_height,
                was_downscaled=was_downscaled,
            ),
            annotated_image_url=annotated_url,
            processing_time_ms=latency_ms,
            quality=quality_assessment,
        )

        return response_payload
    finally:
        # Guarantee closure and unlinking of spooled temporary files across all exit paths (REL-03)
        try:
            await image.close()
        except Exception:
            pass
