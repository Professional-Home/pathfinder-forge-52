"""FastAPI Application for AI-Based Petri Dish Colony Counting Tool."""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

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

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB limit
ALLOWED_MIME_PREFIXES = ("image/",)

# Detector instance (singleton)
detector: Optional[ColonyDetector] = None


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

raw_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:8080,http://localhost:5173")
allowed_origins = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

logger.info(f"Configuring CORS for allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ─── Static Files (Annotated Visualization Artifacts) ──────────────────────────

app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")


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
    model_path = str(detector.model_path) if detector else None

    return HealthResponse(
        status="ok",
        model_loaded=model_loaded,
        model_path=model_path,
    )


@app.post(
    "/api/v1/detect-colonies",
    response_model=ColonyDetectionSuccessResponse,
    responses={
        400: {"model": ColonyDetectionErrorResponse},
        413: {"model": ColonyDetectionErrorResponse},
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

    # 3. Read image bytes with 5 MB size limit enforcement
    try:
        contents = await image.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        return make_error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_IMAGE",
            "Failed to read the uploaded image file.",
        )

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        size_mb = round(len(contents) / (1024 * 1024), 2)
        return make_error_response(
            status.HTTP_413_CONTENT_TOO_LARGE
            if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE")
            else 413,
            "IMAGE_TOO_LARGE",
            f"Image size ({size_mb} MB) exceeds maximum allowed limit of 5 MB.",
        )

    if len(contents) == 0:
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

    # 5. Execute detection inference
    try:
        detections, width, height, latency_ms, annotated_image = detector.detect(
            image_bytes=contents,
            confidence_threshold=confidence_threshold,
        )
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

    # 6. Save annotated image visualization artifact
    annotated_filename = f"annotated_{uuid.uuid4().hex[:12]}.jpg"
    annotated_filepath = OUTPUTS_DIR / annotated_filename
    try:
        annotated_image.save(annotated_filepath, format="JPEG", quality=90)
    except Exception as e:
        logger.warning(f"Could not write annotated image artifact: {e}")

    # Build public URL for annotated image
    public_base = os.getenv("PUBLIC_BASE_URL", str(request.base_url).rstrip("/"))
    annotated_url = f"{public_base}/outputs/{annotated_filename}"

    # 7. Assess colony plate density, crowding, and review indicators
    quality_assessment = assess_colony_quality(detections)

    # 8. Construct and return validated response
    response_payload = ColonyDetectionSuccessResponse(
        success=True,
        count=len(detections),
        detections=detections,
        image=ColonyImageMetadata(width=width, height=height),
        annotated_image_url=annotated_url,
        processing_time_ms=latency_ms,
        quality=quality_assessment,
    )

    return response_payload
