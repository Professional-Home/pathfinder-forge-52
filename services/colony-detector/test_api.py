"""Automated test suite verifying the Colony Detector API contracts, validators, and error responses."""

import io
import sys
from pathlib import Path

# Add project directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from unittest.mock import MagicMock, patch
from PIL import Image
from starlette.testclient import TestClient

from app.main import app, limiter
from app.limiter import TokenBucketLimiter, create_rate_limiter_from_env, get_client_ip


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Ensures each test has a fresh, clean rate limiter state."""
    limiter.reset()
    yield
    limiter.reset()


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


def test_rel03_zero_byte_upload_rejected():
    """Verifies that 0-byte uploads are rejected with 400 INVALID_IMAGE and never reach detector (REL-03 A)."""
    with patch("app.detector.ColonyDetector.detect") as mock_detect:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("zero.jpg", io.BytesIO(b""), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 400
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "INVALID_IMAGE"
            assert "empty" in data["error"]["message"].lower()
            mock_detect.assert_not_called()
    print("[PASS] test_rel03_zero_byte_upload_rejected passed.")


def test_rel03_under_limit_upload_accepted():
    """Verifies that valid images under the 5 MB limit are accepted and processed (REL-03 B)."""
    img = Image.new("RGB", (200, 200), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("under_limit.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["image"]["width"] == 200
        assert data["image"]["height"] == 200
    print("[PASS] test_rel03_under_limit_upload_accepted passed.")


def test_rel03_exactly_at_limit_upload_deterministic():
    """Verifies deterministic boundary behavior: exactly 5 MB accepted, 5 MB + 1 byte rejected (REL-03 C)."""
    limit_bytes = 5 * 1024 * 1024  # 5,242,880 bytes

    # 1. Create a valid JPEG and pad to exactly 5,242,880 bytes
    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw_jpeg = buf.getvalue()
    assert len(raw_jpeg) < limit_bytes
    exact_limit_payload = raw_jpeg + b"\x00" * (limit_bytes - len(raw_jpeg))
    assert len(exact_limit_payload) == limit_bytes

    with TestClient(app) as client:
        # At exactly 5 MB, request is accepted (not 413)
        res_exact = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("exact_5mb.jpg", io.BytesIO(exact_limit_payload), "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert res_exact.status_code == 200, f"Expected 200 at limit, got {res_exact.status_code}: {res_exact.text}"
        data_exact = res_exact.json()
        assert data_exact["success"] is True

        # At exactly 5 MB + 1 byte, request is rejected with 413 IMAGE_TOO_LARGE
        over_one_byte_payload = exact_limit_payload + b"x"
        assert len(over_one_byte_payload) == limit_bytes + 1

        res_over = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("over_1byte.jpg", io.BytesIO(over_one_byte_payload), "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert res_over.status_code == 413, f"Expected 413 at limit+1, got {res_over.status_code}"
        data_over = res_over.json()
        assert data_over["success"] is False
        assert data_over["error"]["code"] == "IMAGE_TOO_LARGE"
        assert "5.0 mb" in data_over["error"]["message"].lower()

    print("[PASS] test_rel03_exactly_at_limit_upload_deterministic passed.")


def test_rel03_over_limit_upload_rejected_before_inference():
    """Verifies that oversized uploads (> 5 MB) are rejected before detector is called (REL-03 D)."""
    oversized = b"x" * (5 * 1024 * 1024 + 1024)  # 5 MB + 1 KB

    with patch("app.detector.ColonyDetector.detect") as mock_detect:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("oversized.jpg", io.BytesIO(oversized), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 413
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "IMAGE_TOO_LARGE"
            mock_detect.assert_not_called()

    print("[PASS] test_rel03_over_limit_upload_rejected_before_inference passed.")


def test_rel03_large_multipart_disk_spooling():
    """Verifies that uploads > 1 MB roll over to disk (SpooledTemporaryFile) rather than buffering in RAM (REL-03 E)."""
    # Create an image ~1.5 MB (> Starlette's 1 MB spool_max_size threshold)
    img = Image.new("RGB", (1000, 1000), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    large_bytes = buf.getvalue()
    # Pad to ensure it exceeds 1.5 MB
    if len(large_bytes) < 1500000:
        large_bytes = large_bytes + b"\x00" * (1500000 - len(large_bytes))
    assert len(large_bytes) > 1024 * 1024, "Payload must exceed Starlette 1 MB spool threshold"

    spooled_file_inspected = {}

    from app.detector import ColonyDetector
    original_detect = ColonyDetector.detect

    def spy_detect(self, *args, **kwargs):
        image_input = kwargs.get("image_input") or (args[0] if args else None)
        spooled_file_inspected["is_file_like"] = hasattr(image_input, "read") and hasattr(image_input, "seek")
        spooled_file_inspected["is_spooled"] = "SpooledTemporaryFile" in type(image_input).__name__
        spooled_file_inspected["rolled_over"] = getattr(image_input, "_rolled", False)
        return original_detect(self, *args, **kwargs)

    with patch.object(ColonyDetector, "detect", spy_detect):
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("spooled_dish.jpg", io.BytesIO(large_bytes), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    assert spooled_file_inspected.get("is_file_like") is True, "Image input passed to detector must be a file stream"
    assert spooled_file_inspected.get("is_spooled") is True, "Image input must be SpooledTemporaryFile"
    assert spooled_file_inspected.get("rolled_over") is True, "Payload > 1 MB must roll over to disk temporary file"
    print("[PASS] test_rel03_large_multipart_disk_spooling passed:", spooled_file_inspected)


def test_rel03_cleanup_on_all_execution_paths():
    """Verifies that temporary files are closed and unlinked across success, failure, abort, and disconnect paths (REL-03 F)."""
    from unittest.mock import AsyncMock
    captured_files = []

    from app.main import get_upload_file_size as orig_get_size

    def spy_get_size(upload_file):
        captured_files.append(upload_file)
        return orig_get_size(upload_file)

    with patch("app.main.get_upload_file_size", side_effect=spy_get_size):
        with TestClient(app) as client:
            # 1. Success path
            img = Image.new("RGB", (100, 100), color="white")
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            res1 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("ok.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")},
            )
            assert res1.status_code == 200
            assert captured_files[-1].file.closed is True, "Success path must close SpooledTemporaryFile"

            # 2. Oversized path (413)
            oversized_data = b"x" * (5 * 1024 * 1024 + 1024)
            res2 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("huge.jpg", io.BytesIO(oversized_data), "image/jpeg")},
            )
            assert res2.status_code == 413
            assert captured_files[-1].file.closed is True, "Oversized path must close SpooledTemporaryFile"

            # 3. Corrupt image data (400)
            corrupt_data = b"not-a-valid-jpeg-image-header" * 50
            res3 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("corrupt.jpg", io.BytesIO(corrupt_data), "image/jpeg")},
            )
            assert res3.status_code == 400
            assert captured_files[-1].file.closed is True, "Corrupt image path must close SpooledTemporaryFile"

            # 4. Disconnect path (499)
            with patch("starlette.requests.Request.is_disconnected", new_callable=AsyncMock) as mock_disc:
                mock_disc.return_value = True
                res4 = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": ("disc.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")},
                )
                assert res4.status_code == 499
                assert captured_files[-1].file.closed is True, "Disconnect path must close SpooledTemporaryFile"

    print("[PASS] test_rel03_cleanup_on_all_execution_paths passed successfully.")


def test_prf01_small_normal_image_unchanged():
    """Verifies that an image below maximum dimension remains untouched without downscaling (PRF-01 A)."""
    from app.detector import preprocess_specimen_image

    img = Image.new("RGB", (1024, 768), color="white")
    processed, raw_w, raw_h, was_downscaled = preprocess_specimen_image(img, max_dimension=2048)
    assert processed.size == (1024, 768)
    assert raw_w == 1024
    assert raw_h == 768
    assert was_downscaled is False
    print("[PASS] test_prf01_small_normal_image_unchanged passed.")


def test_prf01_image_exactly_at_limit_deterministic():
    """Verifies that an image exactly at the configured maximum dimension (2048) remains untouched (PRF-01 B)."""
    from app.detector import preprocess_specimen_image

    img_square = Image.new("RGB", (2048, 2048), color="white")
    proc_sq, raw_w, raw_h, downscaled_sq = preprocess_specimen_image(img_square, max_dimension=2048)
    assert proc_sq.size == (2048, 2048)
    assert downscaled_sq is False

    img_rect = Image.new("RGB", (2048, 1536), color="white")
    proc_rect, raw_w, raw_h, downscaled_rect = preprocess_specimen_image(img_rect, max_dimension=2048)
    assert proc_rect.size == (2048, 1536)
    assert downscaled_rect is False
    print("[PASS] test_prf01_image_exactly_at_limit_deterministic passed.")


def test_prf01_oversized_image_downscaled_and_aspect_ratio_preserved():
    """Verifies that an oversized image (4096x2048) is downscaled to max 2048 while preserving 2:1 aspect ratio (PRF-01 C)."""
    from app.detector import preprocess_specimen_image

    img = Image.new("RGB", (4096, 2048), color="white")
    processed, raw_w, raw_h, was_downscaled = preprocess_specimen_image(img, max_dimension=2048)
    assert was_downscaled is True
    assert raw_w == 4096
    assert raw_h == 2048
    assert processed.size == (2048, 1024)
    orig_ratio = 4096 / 2048
    new_ratio = processed.size[0] / processed.size[1]
    assert abs(orig_ratio - new_ratio) < 1e-4
    print("[PASS] test_prf01_oversized_image_downscaled_and_aspect_ratio_preserved passed.")


def test_prf01_small_image_never_upscaled():
    """Verifies that small specimen images (e.g. 160x120) are never upscaled (PRF-01 D)."""
    from app.detector import preprocess_specimen_image

    img = Image.new("RGB", (160, 120), color="white")
    processed, raw_w, raw_h, was_downscaled = preprocess_specimen_image(img, max_dimension=2048)
    assert processed.size == (160, 120)
    assert was_downscaled is False
    assert raw_w == 160
    assert raw_h == 120
    print("[PASS] test_prf01_small_image_never_upscaled passed.")


def test_prf01_non_square_aspect_ratio_preserved():
    """Verifies that non-square portrait and landscape images strictly preserve aspect ratio (PRF-01 E)."""
    from app.detector import preprocess_specimen_image

    # 1. Tall portrait (3000 x 4000)
    img_tall = Image.new("RGB", (3000, 4000), color="white")
    proc_tall, _, _, was_downscaled = preprocess_specimen_image(img_tall, max_dimension=2048)
    assert was_downscaled is True
    assert proc_tall.size == (1536, 2048)
    assert abs((3000 / 4000) - (1536 / 2048)) < 1e-4

    # 2. Ultra-wide panorama (5000 x 2500)
    img_wide = Image.new("RGB", (5000, 2500), color="white")
    proc_wide, _, _, was_downscaled = preprocess_specimen_image(img_wide, max_dimension=2048)
    assert was_downscaled is True
    assert proc_wide.size == (2048, 1024)
    assert abs((5000 / 2500) - (2048 / 1024)) < 1e-4
    print("[PASS] test_prf01_non_square_aspect_ratio_preserved passed.")


def test_prf01_exif_orientation_handling():
    """Verifies that camera images with EXIF orientation tag 6 are upright transposed before downscaling (PRF-01 F)."""
    from app.detector import preprocess_specimen_image

    # Create image 3000x2000 with EXIF tag 6 (indicating 90 deg rotation to 2000x3000 portrait)
    img = Image.new("RGB", (3000, 2000), color="white")
    exif = img.getexif()
    exif[0x0112] = 6  # Orientation: rotate 90 CW
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    buf.seek(0)

    loaded = Image.open(buf)
    proc, raw_w, raw_h, was_downscaled = preprocess_specimen_image(loaded, max_dimension=2048)

    assert raw_w == 2000
    assert raw_h == 3000
    assert proc.size[1] > proc.size[0], "Transposed portrait image height must exceed width"
    assert proc.size == (1365, 2048)
    assert was_downscaled is True
    print("[PASS] test_prf01_exif_orientation_handling passed:", proc.size)


def test_prf01_end_to_end_high_res_inference():
    """Verifies end-to-end API inference on high-res image (3000x3000) produces valid detection response (PRF-01 G)."""
    img = Image.new("RGB", (3000, 3000), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("high_res_plate.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["image"]["width"] == 2048
        assert data["image"]["height"] == 2048
        assert data["image"]["original_width"] == 3000
        assert data["image"]["original_height"] == 3000
        assert data["image"]["was_downscaled"] is True
        assert "processing_time_ms" in data
        assert isinstance(data["count"], int)
        assert "annotated_image_url" in data
    print("[PASS] test_prf01_end_to_end_high_res_inference passed.")


def test_prf01_output_dimensions_and_coordinate_consistency():
    """Verifies that detection bounding boxes and saved annotated artifact dimensions match response.image (PRF-01 H)."""
    from PIL import ImageDraw
    from app.main import OUTPUTS_DIR

    # Create image 4000x3000 with synthetic colony dots
    img = Image.new("RGB", (4000, 3000), color=(240, 240, 240))
    d = ImageDraw.Draw(img)
    d.ellipse([1800, 1300, 2200, 1700], fill=(200, 180, 150), outline=(100, 80, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("colony_dot.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 200
        data = response.json()
        resp_w = data["image"]["width"]
        resp_h = data["image"]["height"]

        # 1. Verify processed image dimensions are normalized
        assert resp_w == 2048
        assert resp_h == 1536
        assert data["image"]["was_downscaled"] is True

        # 2. Verify all bounding box coordinates fall strictly within [0, resp_w] x [0, resp_h]
        for det in data["detections"]:
            assert 0 <= det["x1"] <= resp_w, f"x1 {det['x1']} out of bounds for width {resp_w}"
            assert 0 <= det["x2"] <= resp_w, f"x2 {det['x2']} out of bounds for width {resp_w}"
            assert 0 <= det["y1"] <= resp_h, f"y1 {det['y1']} out of bounds for height {resp_h}"
            assert 0 <= det["y2"] <= resp_h, f"y2 {det['y2']} out of bounds for height {resp_h}"
            assert det["x1"] <= det["x2"]
            assert det["y1"] <= det["y2"]

        # 3. Verify on-disk annotated artifact image matches response dimensions exactly
        annotated_url = data["annotated_image_url"]
        fname = annotated_url.split("/")[-1]
        artifact_path = OUTPUTS_DIR / fname
        assert artifact_path.exists(), "Annotated artifact must exist on disk"

        with Image.open(artifact_path) as art_img:
            assert art_img.size == (resp_w, resp_h), (
                f"Annotated artifact size {art_img.size} must match response dimensions {(resp_w, resp_h)}"
            )

    print("[PASS] test_prf01_output_dimensions_and_coordinate_consistency passed.")


def test_prf01_extreme_dimension_decompression_ceiling_rejected():
    """Verifies that an image exceeding the extreme dimension limit (10000px) is rejected before raster allocation."""
    img = Image.new("RGB", (12000, 12000), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("extreme_dim.jpg", buf, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_IMAGE"
        assert "exceed" in data["error"]["message"].lower()

    print("[PASS] test_prf01_extreme_dimension_decompression_ceiling_rejected passed.")


def _make_test_jpeg_bytes(width=100, height=100):
    img = Image.new("RGB", (width, height), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_sec04_requests_under_limit_accepted():
    """Verifies that requests well under the rate limit succeed normally (SEC-04 A)."""
    limiter.reset()
    jpeg_data = _make_test_jpeg_bytes()

    with TestClient(app, client=("10.10.1.1", 1234)) as client:
        for i in range(3):
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("test.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 200, f"Request {i+1} under limit failed: {response.text}"
            data = response.json()
            assert data["success"] is True
    print("[PASS] test_sec04_requests_under_limit_accepted passed.")


def test_sec04_request_exactly_at_limit_deterministic():
    """Verifies deterministic behavior up to and including the exact rate limit (SEC-04 B)."""
    from app import main

    test_limiter = TokenBucketLimiter(requests=3, window_seconds=60, burst=3)
    orig_limiter = main.limiter
    main.limiter = test_limiter
    jpeg_data = _make_test_jpeg_bytes()

    try:
        with TestClient(app, client=("10.10.2.1", 1234)) as client:
            for i in range(3):
                response = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": (f"test_{i}.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )
                assert response.status_code == 200, f"Request {i+1} at limit failed: {response.text}"
                assert response.json()["success"] is True
            # Exactly 0 tokens should remain now
            assert test_limiter.get_tokens("10.10.2.1") < 1.0
    finally:
        main.limiter = orig_limiter
    print("[PASS] test_sec04_request_exactly_at_limit_deterministic passed.")


def test_sec04_request_exceeding_limit_returns_429():
    """Verifies exceeding rate limit returns 429, RATE_LIMIT_EXCEEDED, and Retry-After header (SEC-04 C)."""
    from app import main

    test_limiter = TokenBucketLimiter(requests=2, window_seconds=60, burst=2)
    orig_limiter = main.limiter
    main.limiter = test_limiter
    jpeg_data = _make_test_jpeg_bytes()

    try:
        with TestClient(app, client=("10.10.3.1", 1234)) as client:
            # First 2 requests succeed
            for i in range(2):
                res = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": (f"test_{i}.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )
                assert res.status_code == 200

            # 3rd request exceeds limit
            response = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("test_exceed.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert response.status_code == 429, f"Expected 429, got {response.status_code}: {response.text}"
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
            assert "Retry-After" in response.headers
            retry_after = int(response.headers["Retry-After"])
            assert retry_after > 0
            assert "wait" in data["error"]["message"].lower()
            assert data["error"]["details"]["retry_after_seconds"] == retry_after
    finally:
        main.limiter = orig_limiter
    print("[PASS] test_sec04_request_exceeding_limit_returns_429 passed.")


def test_sec04_rate_limited_requests_do_not_invoke_inference():
    """Verifies that rate-limited requests are blocked before image decoding or YOLO inference (SEC-04 D)."""
    from app import main
    from app.detector import ColonyDetector

    test_limiter = TokenBucketLimiter(requests=1, window_seconds=60, burst=1)
    orig_limiter = main.limiter
    main.limiter = test_limiter
    jpeg_data = _make_test_jpeg_bytes()

    call_count = 0
    orig_detect = ColonyDetector.detect

    def spy_detect(self, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return orig_detect(self, *args, **kwargs)

    try:
        with patch.object(ColonyDetector, "detect", spy_detect):
            with TestClient(app, client=("10.10.4.1", 1234)) as client:
                # 1st request -> executes detector.detect
                res1 = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": ("allowed.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )
                assert res1.status_code == 200
                assert call_count == 1

                # 2nd and 3rd requests -> throttled with 429
                res2 = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": ("blocked1.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )
                assert res2.status_code == 429

                res3 = client.post(
                    "/api/v1/detect-colonies",
                    files={"image": ("blocked2.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                    data={"confidence_threshold": "0.30"},
                )
                assert res3.status_code == 429

                # detector.detect MUST NOT have been called for throttled requests
                assert call_count == 1, (
                    f"ColonyDetector.detect was called {call_count} times, expected exactly 1"
                )
    finally:
        main.limiter = orig_limiter
    print("[PASS] test_sec04_rate_limited_requests_do_not_invoke_inference passed.")


def test_sec04_different_client_identities_independent_limits():
    """Verifies that separate client IP addresses have isolated rate limit buckets (SEC-04 E)."""
    from app import main

    test_limiter = TokenBucketLimiter(requests=2, window_seconds=60, burst=2)
    orig_limiter = main.limiter
    main.limiter = test_limiter
    jpeg_data = _make_test_jpeg_bytes()

    try:
        # Client Alpha exhausts its limit
        with TestClient(app, client=("192.168.1.100", 1000)) as client_a:
            r1 = client_a.post(
                "/api/v1/detect-colonies",
                files={"image": ("a1.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert r1.status_code == 200
            r2 = client_a.post(
                "/api/v1/detect-colonies",
                files={"image": ("a2.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert r2.status_code == 200
            r3 = client_a.post(
                "/api/v1/detect-colonies",
                files={"image": ("a3.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert r3.status_code == 429, "Client Alpha must be throttled"

        # Client Beta sends a request from a different IP -> must be accepted
        with TestClient(app, client=("192.168.1.200", 2000)) as client_b:
            rb1 = client_b.post(
                "/api/v1/detect-colonies",
                files={"image": ("b1.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert rb1.status_code == 200, f"Client Beta should not be throttled: {rb1.text}"
            assert rb1.json()["success"] is True
    finally:
        main.limiter = orig_limiter
    print("[PASS] test_sec04_different_client_identities_independent_limits passed.")


def test_sec04_window_recovery_after_period():
    """Verifies that tokens replenish and requests become allowed again after time advances (SEC-04 F)."""
    from app import main

    clock = [1000.0]
    test_limiter = TokenBucketLimiter(
        requests=2,
        window_seconds=10,
        burst=2,
        time_func=lambda: clock[0],
    )
    orig_limiter = main.limiter
    main.limiter = test_limiter
    jpeg_data = _make_test_jpeg_bytes()

    try:
        with TestClient(app, client=("10.10.5.1", 1234)) as client:
            # 2 requests succeed at t=1000
            res1 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t1.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res1.status_code == 200
            res2 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t2.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res2.status_code == 200

            # 3rd request throttled at t=1000
            res3 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t3.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res3.status_code == 429
            retry_after = int(res3.headers["Retry-After"])
            assert retry_after == 5  # 1 token needed at rate 0.2 tok/s = 5s

            # Advance clock by 5 seconds (1 token replenished)
            clock[0] += 5.0
            res4 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t4.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res4.status_code == 200, "Request after 5s recovery must be accepted"

            # Advance clock by 10 seconds (full bucket replenished)
            clock[0] += 10.0
            res5 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t5.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res5.status_code == 200
            res6 = client.post(
                "/api/v1/detect-colonies",
                files={"image": ("t6.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
                data={"confidence_threshold": "0.30"},
            )
            assert res6.status_code == 200
    finally:
        main.limiter = orig_limiter
    print("[PASS] test_sec04_window_recovery_after_period passed.")


def test_sec04_concurrency_semaphore_still_caps_inference_at_2():
    """Verifies that the asyncio concurrency semaphore of 2 remains fully active alongside rate limiting (SEC-04 G)."""
    import asyncio
    from app.main import MAX_CONCURRENT_INFERENCES, get_inference_semaphore

    assert MAX_CONCURRENT_INFERENCES == 2

    async def _check_semaphore():
        sem = get_inference_semaphore()
        assert isinstance(sem, asyncio.Semaphore)
        assert sem._value == 2

    asyncio.run(_check_semaphore())
    print("[PASS] test_sec04_concurrency_semaphore_still_caps_inference_at_2 passed.")


def test_sec04_existing_error_behavior_preserved():
    """Verifies existing error responses (413, 400, 499) remain unchanged under rate limiting (SEC-04 H)."""
    limiter.reset()

    with TestClient(app, client=("10.10.6.1", 1234)) as client:
        # 1. 400 on invalid confidence
        res_conf = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("test.jpg", io.BytesIO(_make_test_jpeg_bytes()), "image/jpeg")},
            data={"confidence_threshold": "0.99"},
        )
        assert res_conf.status_code == 400
        assert res_conf.json()["error"]["code"] == "INVALID_CONFIDENCE_THRESHOLD"

        # 2. 400 on non-image MIME
        res_mime = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("data.txt", io.BytesIO(b"not image"), "text/plain")},
            data={"confidence_threshold": "0.30"},
        )
        assert res_mime.status_code == 400
        assert res_mime.json()["error"]["code"] == "INVALID_IMAGE"

        # 3. 413 on oversized file (>5 MB)
        oversized = io.BytesIO(b"X" * (5 * 1024 * 1024 + 10))
        res_size = client.post(
            "/api/v1/detect-colonies",
            files={"image": ("large.jpg", oversized, "image/jpeg")},
            data={"confidence_threshold": "0.30"},
        )
        assert res_size.status_code == 413
        assert res_size.json()["error"]["code"] == "IMAGE_TOO_LARGE"

    print("[PASS] test_sec04_existing_error_behavior_preserved passed.")


def test_sec04_env_var_configuration_overrides():
    """Verifies rate limiter policy can be customized via environment variables (SEC-04 I)."""
    env_overrides = {
        "COLONY_RATE_LIMIT_REQUESTS": "25",
        "COLONY_RATE_LIMIT_WINDOW_SECONDS": "120",
        "COLONY_RATE_LIMIT_BURST": "30",
        "COLONY_RATE_LIMIT_ENABLED": "true",
        "COLONY_TRUSTED_PROXIES": "10.0.0.1, 10.0.0.2",
    }
    with patch.dict("os.environ", env_overrides):
        custom_limiter = create_rate_limiter_from_env()
        assert custom_limiter.requests == 25
        assert custom_limiter.window_seconds == 120
        assert custom_limiter.capacity == 30.0
        assert abs(custom_limiter.rate - (25.0 / 120.0)) < 1e-6
        assert custom_limiter.enabled is True
        assert "10.0.0.1" in custom_limiter.trusted_proxies
        assert "10.0.0.2" in custom_limiter.trusted_proxies
    print("[PASS] test_sec04_env_var_configuration_overrides passed.")


def test_sec04_trusted_proxy_and_anti_spoofing():
    """Verifies X-Forwarded-For is ignored from untrusted direct IPs, but accepted from trusted proxies."""
    from starlette.requests import Request

    # Case 1: Untrusted direct connection (no trusted proxies configured)
    scope1 = {
        "type": "http",
        "client": ("198.51.100.5", 54321),
        "headers": [(b"x-forwarded-for", b"203.0.113.195")],
    }
    req1 = Request(scope1)
    # Must use direct socket IP, ignoring spoofed X-Forwarded-For
    assert get_client_ip(req1, trusted_proxies=[]) == "198.51.100.5"

    # Case 2: Direct connection from verified reverse proxy (e.g. 10.0.0.1)
    scope2 = {
        "type": "http",
        "client": ("10.0.0.1", 54321),
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 10.0.0.1")],
    }
    req2 = Request(scope2)
    # Must extract client IP from X-Forwarded-For
    assert get_client_ip(req2, trusted_proxies=["10.0.0.1"]) == "203.0.113.195"

    print("[PASS] test_sec04_trusted_proxy_and_anti_spoofing passed.")


# =========================================================================
# Background Colony Artifact Cleanup Tests
# =========================================================================


def test_bg_cleanup_configuration():
    """Verifies default, custom, and safe fallback handling for COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS."""
    from app.main import get_cleanup_interval_from_env, DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS

    # 1. Default when unset
    with patch.dict("os.environ", {}, clear=True):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS
        assert get_cleanup_interval_from_env() == 600

    # 2. Valid custom positive integer
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "120"}):
        assert get_cleanup_interval_from_env() == 120

    # 3. Valid custom positive float is converted to integer
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "300.5"}):
        assert get_cleanup_interval_from_env() == 300

    # 4. Zero interval falls back safely to default (prevents busy loop)
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "0"}):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS

    # 5. Negative interval falls back safely to default
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "-10"}):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS

    # 6. Non-numeric string falls back safely to default
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "invalid_seconds"}):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS

    # 7. Infinity or NaN falls back safely to default
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "inf"}):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS
    with patch.dict("os.environ", {"COLONY_OUTPUT_CLEANUP_INTERVAL_SECONDS": "nan"}):
        assert get_cleanup_interval_from_env() == DEFAULT_OUTPUT_CLEANUP_INTERVAL_SECONDS

    print("[PASS] test_bg_cleanup_configuration passed.")


def test_bg_cleanup_lifecycle_management():
    """Verifies that the background cleanup task starts exactly once and is cleanly cancelled on shutdown without orphans."""
    import asyncio

    with TestClient(app) as client:
        # App is alive inside the context manager
        cleanup_task = getattr(app.state, "cleanup_task", None)
        assert cleanup_task is not None, "Cleanup task should be stored on app.state"
        assert isinstance(cleanup_task, asyncio.Task), "Cleanup task must be an asyncio.Task"
        assert not cleanup_task.done(), "Cleanup task should be running while app is active"
        assert cleanup_task.get_name() == "colony_artifact_cleanup"

        # Verify endpoint works normally while cleanup task is alive
        res = client.get("/health")
        assert res.status_code == 200

    # TestClient context exited -> lifespan shutdown triggered
    assert cleanup_task.done(), "Cleanup task must be terminated when lifespan shuts down"
    # Task was either cancelled or completed upon cancellation
    assert cleanup_task.cancelled() or cleanup_task.done()

    print("[PASS] test_bg_cleanup_lifecycle_management passed.")


def test_bg_cleanup_periodic_execution_and_resilience():
    """Verifies periodic cleanup invokes prune logic, recovers from cycle errors, and cancels cleanly."""
    import asyncio
    from app.main import run_periodic_artifact_cleanup

    calls = []
    cycle_count = 0

    def mock_prune(outputs_dir, max_age_seconds, max_files, **kwargs):
        nonlocal cycle_count
        cycle_count += 1
        calls.append((outputs_dir, max_age_seconds, max_files))
        if cycle_count == 1:
            # Simulate a transient filesystem error in cycle 1
            raise OSError("Simulated transient disk I/O error during scan")
        return 3  # cycle 2 succeeds and reports 3 removed

    sleep_count = 0

    async def mock_sleep(interval):
        nonlocal sleep_count
        sleep_count += 1
        assert interval == 15
        if sleep_count > 2:
            # Trigger cancellation after 2 full cycles
            raise asyncio.CancelledError()

    async def _run_test():
        dummy_dir = Path("/tmp/mock_colony_outputs")
        with patch("app.main.prune_output_artifacts", side_effect=mock_prune), \
             patch("asyncio.sleep", side_effect=mock_sleep):
            try:
                await run_periodic_artifact_cleanup(
                    outputs_dir=dummy_dir,
                    interval_seconds=15,
                    max_age_seconds=1800,
                    max_files=40,
                )
            except asyncio.CancelledError:
                pass

    asyncio.run(_run_test())

    # Cycle 1 raised OSError, but loop did not crash and ran cycle 2
    assert cycle_count == 2, f"Expected 2 cleanup cycles executed, got {cycle_count}"
    assert len(calls) == 2
    assert calls[0] == (Path("/tmp/mock_colony_outputs"), 1800, 40)
    assert calls[1] == (Path("/tmp/mock_colony_outputs"), 1800, 40)

    print("[PASS] test_bg_cleanup_periodic_execution_and_resilience passed.")


def test_bg_cleanup_filesystem_retention_rules():
    """Verifies background pruning strictly respects artifact naming conventions, age, and max_files limits."""
    import os
    import time
    import tempfile
    from app.main import prune_output_artifacts

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        now = time.time()

        # 1. Old annotated artifact (> 3600s) -> MUST BE REMOVED
        stale_artifact = tmp_path / "annotated_stale0123456789abcdef012345.jpg"
        stale_artifact.write_bytes(b"stale_data")
        os.utime(stale_artifact, (now - 7200, now - 7200))

        # 2. Fresh annotated artifact (< 3600s) -> MUST BE PRESERVED
        fresh_artifact = tmp_path / "annotated_fresh0123456789abcdef012345.jpg"
        fresh_artifact.write_bytes(b"fresh_data")
        os.utime(fresh_artifact, (now - 30, now - 30))

        # 3. Non-annotated JPEG -> MUST NEVER BE TOUCHED
        other_jpg = tmp_path / "specimen_sample.jpg"
        other_jpg.write_bytes(b"specimen")
        os.utime(other_jpg, (now - 7200, now - 7200))

        # 4. Non-image file -> MUST NEVER BE TOUCHED
        safe_model = tmp_path / "weights.pt"
        safe_model.write_bytes(b"weights")
        os.utime(safe_model, (now - 7200, now - 7200))

        # Run prune
        removed = prune_output_artifacts(
            outputs_dir=tmp_path,
            max_age_seconds=3600,
            max_files=10,
        )

        assert removed == 1, f"Expected 1 evicted file, got {removed}"
        assert not stale_artifact.exists(), "Stale annotated artifact should have been deleted"
        assert fresh_artifact.exists(), "Fresh annotated artifact must be preserved"
        assert other_jpg.exists(), "Non-annotated jpg must never be deleted"
        assert safe_model.exists(), "Non-annotated weights file must never be deleted"

        # 5. Test max_files ceiling eviction
        extra_fresh = []
        for i in range(5):
            f = tmp_path / f"annotated_overflow_{i}.jpg"
            f.write_bytes(b"overflow")
            # Stagger timestamps: 0 is oldest, 4 is newest
            os.utime(f, (now - 50 + i * 5, now - 50 + i * 5))
            extra_fresh.append(f)

        # Now tmp_path has fresh_artifact + 5 extra_fresh = 6 annotated files
        # Pruning with max_files=2 should evict 4 oldest files
        overflow_removed = prune_output_artifacts(
            outputs_dir=tmp_path,
            max_age_seconds=3600,
            max_files=2,
        )
        assert overflow_removed == 4, f"Expected 4 evicted files, got {overflow_removed}"
        remaining = list(tmp_path.glob("annotated_*.jpg"))
        assert len(remaining) == 2, f"Expected exactly 2 remaining files, got {len(remaining)}"

    print("[PASS] test_bg_cleanup_filesystem_retention_rules passed.")


if __name__ == "__main__":
    print("\n--- Running Colony Detector API Tests ---\n")
    tests = [
        test_health_check_with_model,
        test_health_check_model_path_leak_prevention,
        test_health_check_without_model,
        test_missing_image_file,
        test_invalid_confidence_threshold_too_low,
        test_invalid_confidence_threshold_too_high,
        test_non_image_file,
        test_oversized_image,
        test_empty_image_upload,
        test_missing_model_when_analyzing,
        test_real_inference_with_model,
        test_colony_quality_assessment_tiers,
        test_prune_output_artifacts_retention,
        test_concurrent_health_during_inference,
        test_concurrent_inference_throttled_to_max_2,
        test_client_disconnect_prevents_inference,
        test_output_artifact_serving_and_security,
        test_cors_configuration_resolution,
        # REL-03 focused test additions
        test_rel03_zero_byte_upload_rejected,
        test_rel03_under_limit_upload_accepted,
        test_rel03_exactly_at_limit_upload_deterministic,
        test_rel03_over_limit_upload_rejected_before_inference,
        test_rel03_large_multipart_disk_spooling,
        test_rel03_cleanup_on_all_execution_paths,
        # PRF-01 high-resolution preprocessing test additions
        test_prf01_small_normal_image_unchanged,
        test_prf01_image_exactly_at_limit_deterministic,
        test_prf01_oversized_image_downscaled_and_aspect_ratio_preserved,
        test_prf01_small_image_never_upscaled,
        test_prf01_non_square_aspect_ratio_preserved,
        test_prf01_exif_orientation_handling,
        test_prf01_end_to_end_high_res_inference,
        test_prf01_output_dimensions_and_coordinate_consistency,
        test_prf01_extreme_dimension_decompression_ceiling_rejected,
        # SEC-04 rate limiting focused test additions
        test_sec04_requests_under_limit_accepted,
        test_sec04_request_exactly_at_limit_deterministic,
        test_sec04_request_exceeding_limit_returns_429,
        test_sec04_rate_limited_requests_do_not_invoke_inference,
        test_sec04_different_client_identities_independent_limits,
        test_sec04_window_recovery_after_period,
        test_sec04_concurrency_semaphore_still_caps_inference_at_2,
        test_sec04_existing_error_behavior_preserved,
        test_sec04_env_var_configuration_overrides,
        test_sec04_trusted_proxy_and_anti_spoofing,
        # Background colony artifact cleanup test additions
        test_bg_cleanup_configuration,
        test_bg_cleanup_lifecycle_management,
        test_bg_cleanup_periodic_execution_and_resilience,
        test_bg_cleanup_filesystem_retention_rules,
    ]
    for test_fn in tests:
        limiter.reset()
        test_fn()
        limiter.reset()
    print("\n--- All Tests Passed Successfully! ---\n")

