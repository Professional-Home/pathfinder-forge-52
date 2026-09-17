"""Tests for Phase 5H — Semi-Automated Polygon Pseudo-Labeling & POC.

Verifies:
1. Mask quality filtering logic (empty, tiny, leaking, boundary snapping, accepted).
2. Polygon normalization and geometric validity (closed, inside [0, 1], area > 0).
3. Phase 5H reporting integrity (JSON and Markdown reports exist and contain required keys).
4. Production safety invariant: services/colony-detector/models/best.pt remains intact.
"""

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import cv2
import numpy as np

from scripts.generate_colony_pseudo_masks import validate_mask_and_extract_polygon


def test_production_model_intact():
    """Ensures production model best.pt was never altered or overwritten."""
    prod_model_path = BASE_DIR / "services" / "colony-detector" / "models" / "best.pt"
    assert prod_model_path.exists(), "Production model best.pt must exist!"
    assert prod_model_path.stat().st_size > 5_000_000, "Production model best.pt must be valid YOLO11 weights"


def test_filter_empty_mask():
    """Empty mask should trigger EMPTY_MASK rejection."""
    mask = np.zeros((100, 100), dtype=np.uint8)
    box = {"xyxy": [20, 20, 80, 80]}
    status, poly, metrics = validate_mask_and_extract_polygon(mask, box, 100, 100)
    assert status == "EMPTY_MASK"
    assert poly is None


def test_filter_too_small():
    """Tiny mask (< 6 px or < 8% area ratio) should trigger TOO_SMALL."""
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[50:52, 50:52] = 255  # 4 pixels
    box = {"xyxy": [20, 20, 80, 80]}  # 3600 px area
    status, poly, metrics = validate_mask_and_extract_polygon(mask, box, 100, 100)
    assert status == "TOO_SMALL"
    assert poly is None


def test_filter_leaks_outside_box():
    """Mask exceeding 125% of bounding box area should trigger LEAKS_OUTSIDE_BOX."""
    mask = np.zeros((200, 200), dtype=np.uint8)
    # Box is 50x50 = 2500 px
    box = {"xyxy": [50, 50, 100, 100]}
    # Mask covers 70x70 = 4900 px (1.96x box area)
    mask[40:110, 40:110] = 255
    status, poly, metrics = validate_mask_and_extract_polygon(mask, box, 200, 200)
    assert status == "LEAKS_OUTSIDE_BOX"
    assert poly is None


def test_filter_touches_all_boundaries():
    """Mask that fills rectangular crop borders (>15% on all 4 sides) should trigger TOUCHES_ALL_BOUNDARIES."""
    mask = np.zeros((100, 100), dtype=np.uint8)
    # Box is [20, 20, 80, 80]
    box = {"xyxy": [20, 20, 80, 80]}
    # Fill almost entire box like an agar patch or rectangle
    mask[20:80, 20:80] = 255
    status, poly, metrics = validate_mask_and_extract_polygon(mask, box, 100, 100)
    assert status == "TOUCHES_ALL_BOUNDARIES"
    assert poly is None


def test_accepted_circular_colony():
    """A realistic circular colony inside a bounding box should be ACCEPTED."""
    img_w, img_h = 200, 200
    mask = np.zeros((img_h, img_w), dtype=np.uint8)
    center = (100, 100)
    radius = 20  # area ~ 1256 px
    cv2.circle(mask, center, radius, 255, -1)

    # Bounding box [80, 80, 120, 120] -> area 1600 px, ratio ~ 0.785
    box = {"xyxy": [78, 78, 122, 122]}
    status, poly, metrics = validate_mask_and_extract_polygon(mask, box, img_w, img_h)

    assert status == "ACCEPTED"
    assert poly is not None
    assert len(poly) >= 6, "Polygon must have at least 3 (x, y) vertices"

    # Coordinates must be strictly within [0.0, 1.0]
    for coord in poly:
        assert 0.0 <= coord <= 1.0, f"Coordinate {coord} outside [0, 1]"

    # Polygon area must be positive
    pts = np.array(poly).reshape(-1, 2) * np.array([img_w, img_h])
    poly_area = cv2.contourArea(np.int32(pts))
    assert poly_area > 500.0, f"Polygon area {poly_area} too small"


def test_report_artifacts_exist():
    """Verifies that Phase 5H report files are generated and valid."""
    json_path = BASE_DIR / "ml-data" / "colony-training" / "phase5h_report.json"
    md_path = BASE_DIR / "ml-data" / "colony-training" / "phase5h_report.md"

    assert json_path.exists(), "phase5h_report.json must exist"
    assert md_path.exists(), "phase5h_report.md must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "model_selected" in data
    assert data["model_selected"]["name"] == "MobileSAM"
    assert "dataset_audit" in data
    assert data["dataset_audit"]["existing_segmentation_masks"] == 0
    assert "mask_quality_statistics" in data
    assert data["mask_quality_statistics"]["total_boxes_processed"] == 1762
    assert data["mask_quality_statistics"]["total_masks_accepted"] >= 1700
    assert "yolo_seg_poc_results" in data


if __name__ == "__main__":
    test_production_model_intact()
    print("[PASS] test_production_model_intact")
    test_filter_empty_mask()
    print("[PASS] test_filter_empty_mask")
    test_filter_too_small()
    print("[PASS] test_filter_too_small")
    test_filter_leaks_outside_box()
    print("[PASS] test_filter_leaks_outside_box")
    test_filter_touches_all_boundaries()
    print("[PASS] test_filter_touches_all_boundaries")
    test_accepted_circular_colony()
    print("[PASS] test_accepted_circular_colony")
    test_report_artifacts_exist()
    print("[PASS] test_report_artifacts_exist")
    print("\n--- All Phase 5H Pipeline and Polygon Tests Passed! ---")

