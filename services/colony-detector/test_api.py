"""Automated test suite verifying the Colony Detector API contracts, validators, and error responses."""

import io
import sys
from pathlib import Path

# Add project directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from unittest.mock import patch
from PIL import Image
from starlette.testclient import TestClient

from app.main import app


def test_health_check_with_model():
    """Verifies GET /health reports ok status and model_loaded=True when best.pt is present."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True
        assert data["model_path"] is not None
        print("[PASS] test_health_check_with_model passed:", data)


def test_health_check_without_model():
    """Verifies GET /health reports ok status and model_loaded=False when model is absent."""
    with patch.dict("os.environ", {"COLONY_MODEL_PATH": "models/non_existent.pt"}):
        with TestClient(app) as client:
            response = client.get("/health")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            data = response.json()
            assert data["status"] == "ok"
            assert data["model_loaded"] is False
            print("[PASS] test_health_check_without_model passed:", data)


def test_invalid_confidence_threshold_too_low():
    """Verifies threshold below 0.20 returns INVALID_CONFIDENCE_THRESHOLD error (400)."""
    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("test.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.10"},
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_CONFIDENCE_THRESHOLD"
        print("[PASS] test_invalid_confidence_threshold_too_low passed:", data["error"])


def test_invalid_confidence_threshold_too_high():
    """Verifies threshold above 0.90 returns INVALID_CONFIDENCE_THRESHOLD error (400)."""
    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("test.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.95"},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_CONFIDENCE_THRESHOLD"
        print("[PASS] test_invalid_confidence_threshold_too_high passed:", data["error"])


def test_missing_image_file():
    """Verifies missing image field returns INVALID_REQUEST (400)."""
    with TestClient(app) as client:
        response = client.post("/api/v1/detect-colonies")
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_REQUEST"
        print("[PASS] test_missing_image_file passed:", data["error"])


def test_non_image_file():
    """Verifies non-image MIME type is rejected with INVALID_IMAGE (400)."""
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("sample.txt", io.BytesIO(b"not an image"), "text/plain")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_IMAGE"
        print("[PASS] test_non_image_file passed:", data["error"])


def test_oversized_image():
    """Verifies images exceeding 5 MB are rejected with IMAGE_TOO_LARGE (413)."""
    oversized_data = b"0" * (5 * 1024 * 1024 + 1024)  # 5 MB + 1 KB
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("large.jpg", io.BytesIO(oversized_data), "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 413, f"Expected 413, got {response.status_code}"
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "IMAGE_TOO_LARGE"
        print("[PASS] test_oversized_image passed:", data["error"])


def test_missing_model_when_analyzing():
    """Verifies that when a valid image is submitted without model, returns MODEL_NOT_CONFIGURED (503)."""
    img = Image.new("RGB", (200, 200), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with patch.dict("os.environ", {"COLONY_MODEL_PATH": "models/non_existent.pt"}):
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("petri.jpg", buf, "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 503, f"Expected 503, got {response.status_code}"
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "MODEL_NOT_CONFIGURED"
            print("[PASS] test_missing_model_when_analyzing passed:", data["error"])


def test_real_inference_with_model():
    """Verifies real YOLO model inference returns valid detection schema, count, boxes, and image."""
    img = Image.new("RGB", (320, 320), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("synthetic_plate.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "count" in data
        assert isinstance(data["count"], int)
        assert "detections" in data
        assert isinstance(data["detections"], list)
        assert len(data["detections"]) == data["count"]
        assert "image" in data
        assert data["image"]["width"] == 320
        assert data["image"]["height"] == 320
        assert "processing_time_ms" in data
        assert data["processing_time_ms"] >= 0
        assert "quality" in data
        assert data["quality"] is not None
        assert data["quality"]["density_level"] in ("low", "medium", "high", "ultra_high")
        assert isinstance(data["quality"]["review_recommended"], bool)
        assert data["quality"]["confluence_risk"] in ("low", "medium", "high")
        assert 0.0 <= data["quality"]["overlap_ratio"] <= 1.0
        assert "reason" in data["quality"]

        # Check detection structure if any detections returned
        for det in data["detections"]:
            assert det["class_id"] == 0
            assert det["class_name"] == "colony"
            assert 0.0 <= det["confidence"] <= 1.0
            assert det["x1"] <= det["x2"]
            assert det["y1"] <= det["y2"]

        print("[PASS] test_real_inference_with_model passed: count =", data["count"], "latency_ms =", data["processing_time_ms"])


def test_colony_quality_assessment_tiers():
    """Unit tests verifying deterministic density tiers, confluence warnings, and overlap logic."""
    from app.detector import assess_colony_quality
    from app.schemas import ColonyDetection

    # 1. Low density (<50)
    low_dets = [
        ColonyDetection(x1=10, y1=10, x2=20, y2=20, confidence=0.85, class_id=0, class_name="colony")
        for _ in range(25)
    ]
    q_low = assess_colony_quality(low_dets)
    assert q_low.density_level == "low"
    assert q_low.review_recommended is False
    assert q_low.warning_message is None

    # 2. Medium density (50-200) with non-overlapping boxes
    med_dets = [
        ColonyDetection(
            x1=i * 25, y1=10, x2=i * 25 + 10, y2=20, confidence=0.85, class_id=0, class_name="colony"
        )
        for i in range(100)
    ]
    q_med = assess_colony_quality(med_dets)
    assert q_med.density_level == "medium"
    assert q_med.review_recommended is False
    assert q_med.confluence_risk == "low"
    assert q_med.overlap_ratio == 0.0

    # 3. High density (201-400)
    high_dets = [
        ColonyDetection(x1=10, y1=10, x2=20, y2=20, confidence=0.85, class_id=0, class_name="colony")
        for _ in range(250)
    ]
    q_high = assess_colony_quality(high_dets)
    assert q_high.density_level == "high"
    assert q_high.review_recommended is True
    assert "High-density plate detected" in q_high.warning_message

    # 4. Ultra-high density (>400)
    ultra_dets = [
        ColonyDetection(x1=10, y1=10, x2=20, y2=20, confidence=0.85, class_id=0, class_name="colony")
        for _ in range(450)
    ]
    q_ultra = assess_colony_quality(ultra_dets)
    assert q_ultra.density_level == "ultra_high"
    assert q_ultra.review_recommended is True
    assert "Very high-density plate detected" in q_ultra.warning_message

    # 5. Overlap ratio detection: 2 overlapping boxes (IoU > 0.10)
    d1 = ColonyDetection(x1=10, y1=10, x2=30, y2=30, confidence=0.9, class_id=0, class_name="colony")
    d2 = ColonyDetection(x1=15, y1=15, x2=35, y2=35, confidence=0.9, class_id=0, class_name="colony")
    d3 = ColonyDetection(x1=200, y1=200, x2=210, y2=210, confidence=0.9, class_id=0, class_name="colony")
    q_overlap = assess_colony_quality([d1, d2, d3])
    assert q_overlap.overlap_ratio > 0.50  # 2 of 3 overlap

    print("[PASS] test_colony_quality_assessment_tiers passed successfully.")


if __name__ == "__main__":
    print("\n--- Running Colony Detector API Tests ---\n")
    test_health_check_with_model()
    test_health_check_without_model()
    test_missing_image_file()
    test_invalid_confidence_threshold_too_low()
    test_invalid_confidence_threshold_too_high()
    test_non_image_file()
    test_oversized_image()
    test_missing_model_when_analyzing()
    test_real_inference_with_model()
    test_colony_quality_assessment_tiers()
    print("\n--- All Tests Passed Successfully! ---\n")
