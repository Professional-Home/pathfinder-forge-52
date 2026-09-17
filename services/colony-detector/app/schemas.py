"""Pydantic data schemas for Colony Detector API matching the frontend contract."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ColonyDetection(BaseModel):
    """Bounding box coordinates and confidence score for a detected colony."""

    x1: float = Field(..., description="Top-left X coordinate in pixels")
    y1: float = Field(..., description="Top-left Y coordinate in pixels")
    x2: float = Field(..., description="Bottom-right X coordinate in pixels")
    y2: float = Field(..., description="Bottom-right Y coordinate in pixels")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0 and 1")
    class_id: int = Field(default=0, description="Class index (0 for colony)")
    class_name: str = Field(default="colony", description="Detected class label name")


class ColonyImageMetadata(BaseModel):
    """Dimensions of the processed specimen image."""

    width: int = Field(..., ge=1, description="Image width in pixels")
    height: int = Field(..., ge=1, description="Image height in pixels")


class ColonyQualityAssessment(BaseModel):
    """Operational plate density, reliability, and confluence quality indicators."""

    density_level: str = Field(
        ...,
        description="Project-specific density tier: 'low' (<50), 'medium' (50-200), 'high' (201-400), or 'ultra_high' (>400)",
    )
    review_recommended: bool = Field(
        ...,
        description="Indicates whether visual confirmation or dilution plate verification is advised",
    )
    warning_message: Optional[str] = Field(
        default=None,
        description="Scientifically cautious advisory message for high-density or crowded cultures",
    )
    confluence_risk: str = Field(
        default="low",
        description="Deterministic crowding/confluence risk indicator: 'low', 'medium', or 'high'",
    )
    overlap_ratio: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Fraction of detected colony boxes exhibiting spatial overlap with adjacent colonies",
    )
    reason: str = Field(
        ...,
        description="Transparent explanation of the quality and reliability assessment",
    )


class ColonyDetectionSuccessResponse(BaseModel):
    """Successful colony quantification response matching frontend TypeScript schema."""

    success: bool = Field(default=True, description="Indicates successful analysis")
    count: int = Field(..., ge=0, description="Total detected colonies after thresholding")
    detections: List[ColonyDetection] = Field(
        default_factory=list, description="Array of individual colony detections"
    )
    image: ColonyImageMetadata = Field(..., description="Specimen image dimensions")
    annotated_image_url: Optional[str] = Field(
        default=None, description="Optional public URL to the server-annotated visualization"
    )
    processing_time_ms: int = Field(
        ..., ge=0, description="Total inference and processing latency in milliseconds"
    )
    quality: Optional[ColonyQualityAssessment] = Field(
        default=None,
        description="Operational plate density, reliability, and confluence quality assessment",
    )


class ColonyErrorDetail(BaseModel):
    """Structured error payload details."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable explanation of error")
    details: Optional[Any] = Field(default=None, description="Optional supplemental context")


class ColonyDetectionErrorResponse(BaseModel):
    """Standardized error response matching frontend ColonyDetectionErrorResponse."""

    success: bool = Field(default=False, description="Always false for error responses")
    error: ColonyErrorDetail


class HealthResponse(BaseModel):
    """API health and model availability check response."""

    status: str = Field(default="ok", description="Service health status")
    model_loaded: bool = Field(..., description="Whether a trained YOLO model is currently loaded")
    model_path: Optional[str] = Field(default=None, description="Configured model weights path")
