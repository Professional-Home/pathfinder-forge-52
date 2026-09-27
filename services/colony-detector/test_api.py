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
        assert data["model_path"] == "models/best.pt"
        assert ":" not in data["model_path"], "No drive letter allowed in model_path (SEC-01)"
        assert "\\" not in data["model_path"], "No backslashes allowed in model_path (SEC-01)"
        assert not data["model_path"].startswith("/"), "No absolute Unix path allowed in model_path (SEC-01)"
        print("[PASS] test_health_check_with_model passed:", data)


def test_health_check_model_path_leak_prevention():
    """Verifies GET /health sanitizes absolute host paths to prevent directory leakage (SEC-01)."""
    from app.main import sanitize_model_path_for_health

    assert (
        sanitize_model_path_for_health(r"F:\Project\pathfinder-forge-52\services\colony-detector\models\best.pt")
        == "models/best.pt"
    )
    assert sanitize_model_path_for_health(r"C:\Users\Admin\secrets\models\best.pt") == "models/best.pt"
    assert sanitize_model_path_for_health("/var/app/services/colony-detector/models/best.pt") == "models/best.pt"
    assert sanitize_model_path_for_health("best.pt") == "models/best.pt"
    print("[PASS] test_health_check_model_path_leak_prevention passed.")


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


def test_empty_image_upload():
    """Verifies empty image upload (0 bytes) returns INVALID_IMAGE (400) (P0-4)."""
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_IMAGE"
        assert "empty" in data["error"]["message"].lower()
        print("[PASS] test_empty_image_upload passed:", data["error"])


def test_prune_output_artifacts_retention():
    """Verifies output retention policy: age-based eviction, file ceiling, and active file preservation (P0-2)."""
    import os
    import time
    import tempfile
    from app.main import prune_output_artifacts

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        now = time.time()

        # 1. Create an old artifact (> 3600s old)
        old_file = tmp_path / "annotated_old12345.jpg"
        old_file.write_bytes(b"old")
        os.utime(old_file, (now - 7200, now - 7200))

        # 2. Create recent artifacts
        recent_files = []
        for i in range(5):
            rf = tmp_path / f"annotated_recent_{i}.jpg"
            rf.write_bytes(b"recent")
            os.utime(rf, (now - (100 - i * 10), now - (100 - i * 10)))
            recent_files.append(rf)

        # 3. Create a non-annotated file (should never be touched)
        safe_file = tmp_path / "model_weights.pt"
        safe_file.write_bytes(b"model")

        # 4. Active request file to preserve
        active_file = tmp_path / "annotated_active.jpg"
        active_file.write_bytes(b"active")

        # Run prune with max_age=3600, max_files=3, preserving active_file
        prune_output_artifacts(
            outputs_dir=tmp_path,
            max_age_seconds=3600,
            max_files=3,
            preserve_filename=active_file.name,
        )

        # Verify old file was evicted
        assert not old_file.exists(), "Old artifact should have been evicted by age"

        # Verify non-annotated file was NOT touched
        assert safe_file.exists(), "Non-annotated file must never be deleted"

        # Verify active file was NOT touched
        assert active_file.exists(), "Active artifact must be preserved"

        # Verify excess recent files were evicted down to max_files=3
        remaining_annotated = list(tmp_path.glob("annotated_recent_*.jpg"))
        assert len(remaining_annotated) <= 3, f"Expected <= 3 recent files, found {len(remaining_annotated)}"

        print("[PASS] test_prune_output_artifacts_retention passed successfully.")


def test_concurrent_health_during_inference():
    """Verifies that the /health endpoint remains responsive and returns 200 (P0-1)."""
    import threading

    with TestClient(app) as client:
        health_results = []

        def ping_health():
            res = client.get("/health")
            health_results.append(res.status_code)

        threads = [threading.Thread(target=ping_health) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert all(code == 200 for code in health_results)
        assert len(health_results) == 5
        print("[PASS] test_concurrent_health_during_inference passed.")


def test_concurrent_inference_throttled_to_max_2():
    """Verifies that concurrent requests are throttled to a maximum of 2 active detector calls (REL-01)."""
    import threading
    import time
    import app.main as main_mod

    active_inferences = 0
    max_observed_concurrency = 0
    lock = threading.Lock()

    def mock_detect(*args, **kwargs):
        nonlocal active_inferences, max_observed_concurrency
        with lock:
            active_inferences += 1
            if active_inferences > max_observed_concurrency:
                max_observed_concurrency = active_inferences
        time.sleep(0.15)
        try:
            return ([], 100, 100, 150, Image.new("RGB", (100, 100), color="white"))
        finally:
            with lock:
                active_inferences -= 1

    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    with patch("app.detector.ColonyDetector.detect", side_effect=mock_detect):
        with TestClient(app) as client:
            threads = []
            for _ in range(5):
                t = threading.Thread(
                    target=lambda: client.post(
                        "/api/v1/detect-colonies",
                        files={"image": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
                        data={"confidence_threshold": "0.30"},
                    )
                )
                threads.append(t)

            for t in threads:
                t.start()
            for t in threads:
                t.join()

    assert max_observed_concurrency <= 2, f"Expected max concurrency <= 2, observed {max_observed_concurrency}"
    assert max_observed_concurrency == 2, f"Expected concurrency of 2 under load, observed {max_observed_concurrency}"
    print(f"[PASS] test_concurrent_inference_throttled_to_max_2 passed: max concurrency was {max_observed_concurrency}")


def test_client_disconnect_prevents_inference():
    """Verifies that a disconnected client request aborts before starting inference (REL-02)."""
    from unittest.mock import AsyncMock
    import app.main as main_mod

    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    detect_called = False

    def mock_detect(*args, **kwargs):
        nonlocal detect_called
        detect_called = True
        return ([], 100, 100, 50, Image.new("RGB", (100, 100), color="white"))

    with patch("app.detector.ColonyDetector.detect", side_effect=mock_detect):
        with patch("starlette.requests.Request.is_disconnected", new_callable=AsyncMock) as mock_disconnected:
            mock_disconnected.return_value = True
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )

                assert response.status_code == 499, f"Expected 499, got {response.status_code}"
                data = response.json()
                assert data["success"] is False
                assert data["error"]["code"] == "CLIENT_CLOSED_REQUEST"
                assert "disconnected" in data["error"]["message"].lower()
                assert detect_called is False, "Inference must NOT be started if client is disconnected"
                print("[PASS] test_client_disconnect_prevents_inference passed:", data["error"])


def test_output_artifact_serving_and_security():
    """Verifies that GET /outputs/{filename} securely serves valid artifacts and blocks traversal/invalid requests (SEC-02)."""
    from app.main import OUTPUTS_DIR

    # 1. Create a legitimate test artifact in OUTPUTS_DIR
    valid_filename = "annotated_0123456789abcdef0123456789abcdef.jpg"
    test_artifact_path = OUTPUTS_DIR / valid_filename
    test_artifact_path.write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")

    try:
        with TestClient(app) as client:
            # 2. Valid artifact request returns 200 with proper headers
            res = client.get(f"/outputs/{valid_filename}")
            assert res.status_code == 200, f"Expected 200, got {res.status_code}"
            assert res.headers["content-type"] == "image/jpeg"
            assert "private" in res.headers.get("cache-control", "")
            assert res.headers.get("x-content-type-options") == "nosniff"

            # 3. Missing artifact returns 404 with structured error
            missing_filename = "annotated_ffffffffffffffffffffffffffffffff.jpg"
            res_missing = client.get(f"/outputs/{missing_filename}")
            assert res_missing.status_code == 404, f"Expected 404, got {res_missing.status_code}"
            data_missing = res_missing.json()
            assert data_missing["success"] is False
            assert data_missing["error"]["code"] == "ARTIFACT_NOT_FOUND"

            # 4. Path traversal attempts return 404 (SEC-02)
            traversal_attempts = [
                "/outputs/..%2fmodels%2fbest.pt",
                "/outputs/..%5c..%5capp%2fmain.py",
                "/outputs/secret.txt",
                "/outputs/annotated_not_hex.jpg",
                "/outputs/annotated_.jpg",
            ]
            for attempt in traversal_attempts:
                res_bad = client.get(attempt)
                assert res_bad.status_code == 404, f"Expected 404 for {attempt}, got {res_bad.status_code}"
                try:
                    data_bad = res_bad.json()
                    if "success" in data_bad:
                        assert data_bad["success"] is False
                except Exception:
                    pass

            print("[PASS] test_output_artifact_serving_and_security passed successfully.")
    finally:
        test_artifact_path.unlink(missing_ok=True)


def test_cors_configuration_resolution():
    """Verifies that CORS origins are explicitly resolved and prevent silent localhost in production (DEP-02)."""
    from app.main import get_cors_origins

    # 1. In development, defaults to local dev servers if FRONTEND_ORIGIN is unset
    with patch.dict("os.environ", {"ENVIRONMENT": "development", "FRONTEND_ORIGIN": ""}):
        dev_origins = get_cors_origins()
        assert "http://localhost:8080" in dev_origins
        assert "http://localhost:5173" in dev_origins

    # 2. In production without FRONTEND_ORIGIN, returns empty list (no silent localhost assumption)
    with patch.dict("os.environ", {"ENVIRONMENT": "production", "FRONTEND_ORIGIN": ""}):
        prod_empty_origins = get_cors_origins()
        assert prod_empty_origins == [], "Production without FRONTEND_ORIGIN must not permit origins"

    # 3. In production with explicit FRONTEND_ORIGIN, returns configured origins
    with patch.dict(
        "os.environ",
        {"ENVIRONMENT": "production", "FRONTEND_ORIGIN": "https://biotech.micrylis.com,https://app.micrylis.com"},
    ):
        prod_configured = get_cors_origins()
        assert prod_configured == ["https://biotech.micrylis.com", "https://app.micrylis.com"]

    # 4. In production with wildcard '*', disallows wildcard
    with patch.dict("os.environ", {"ENVIRONMENT": "production", "FRONTEND_ORIGIN": "*"}):
        prod_wildcard = get_cors_origins()
        assert "*" not in prod_wildcard
        assert prod_wildcard == []

    print("[PASS] test_cors_configuration_resolution passed successfully.")


if __name__ == "__main__":
    print("\n--- Running Colony Detector API Tests ---\n")
    test_health_check_with_model()
    test_health_check_model_path_leak_prevention()
    test_health_check_without_model()
    test_missing_image_file()
    test_invalid_confidence_threshold_too_low()
    test_invalid_confidence_threshold_too_high()
    test_non_image_file()
    test_oversized_image()
    test_empty_image_upload()
    test_missing_model_when_analyzing()
    test_real_inference_with_model()
    test_colony_quality_assessment_tiers()
    test_prune_output_artifacts_retention()
    test_concurrent_health_during_inference()
    test_concurrent_inference_throttled_to_max_2()
    test_client_disconnect_prevents_inference()
    test_output_artifact_serving_and_security()
    test_cors_configuration_resolution()
    print("\n--- All Tests Passed Successfully! ---\n")
