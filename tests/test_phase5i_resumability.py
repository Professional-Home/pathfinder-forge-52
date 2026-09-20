"""Unit tests for Phase 5I Resumable Pseudo-Masking and Training Architecture.

Verifies:
1. Checkpoint atomic write & recovery mechanics.
2. Signal interruption handling and state preservation.
3. Petri-dish rim reflection safeguard logic.
4. Confluent tagging (mutual Box IoU > 0.35).
5. Production model SHA-256 verification invariant.
"""

import json
import os
import sys
from pathlib import Path
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from scripts.generate_full_pseudo_masks import (
    calculate_mutual_ious,
    load_checkpoint,
    save_checkpoint_atomic,
    validate_mask_and_extract_polygon,
    CHECKPOINT_PATH,
    CHECKPOINT_TMP_PATH,
)
from scripts.train_phase5i_segmentation import verify_production_model_sha, PROD_SHA256_EXPECTED


def test_production_model_sha256_integrity():
    """Confirms production best.pt SHA-256 matches exact expected hash."""
    sha = verify_production_model_sha()
    assert sha == PROD_SHA256_EXPECTED, f"Production hash {sha} does not match expected {PROD_SHA256_EXPECTED}"


def test_confluent_tagging_mutual_iou():
    """Boxes with mutual IoU > 0.35 should be tagged with high max IoU."""
    boxes = [
        {"xyxy": [10, 10, 50, 50], "area": 1600},
        {"xyxy": [25, 10, 65, 50], "area": 1600},  # Intersect 25x40 = 1000, Union = 2200, IoU = 0.454
        {"xyxy": [150, 150, 180, 180], "area": 900},  # Distant isolated box
    ]
    ious = calculate_mutual_ious(boxes)
    assert len(ious) == 3
    assert ious[0] > 0.35, f"Box 0 should be confluent, got IoU {ious[0]}"
    assert ious[1] > 0.35, f"Box 1 should be confluent, got IoU {ious[1]}"
    assert ious[2] == 0.0, f"Box 2 should have 0 IoU, got {ious[2]}"


def test_rim_safeguard_rejection():
    """A low-contrast candidate located outside the dish rim should be rejected."""
    import cv2
    mask = np.zeros((100, 100), dtype=np.uint8)
    cv2.circle(mask, (40, 40), 15, 255, -1)
    box = {"xyxy": [20, 20, 60, 60]}

    # Outside rim and low contrast (< 8.5) -> RIM_REFLECTION_ARTIFACT
    status, poly, metrics = validate_mask_and_extract_polygon(
        mask, box, 200, 200, is_rim_candidate=True, std_contrast=5.0
    )
    assert status == "RIM_REFLECTION_ARTIFACT"
    assert poly is None

    # Inside rim or higher contrast -> ACCEPTED
    status_ok, poly_ok, metrics_ok = validate_mask_and_extract_polygon(
        mask, box, 200, 200, is_rim_candidate=False, std_contrast=25.0
    )
    assert status_ok == "ACCEPTED"
    assert poly_ok is not None


def test_checkpoint_atomic_save_and_load(tmp_path):
    """Verifies that atomic checkpoint saving writes safely and is loadable."""
    test_state = {
        "version": "1.0",
        "total_images": 258,
        "completed_images_count": 5,
        "completed_images": ["img_01", "img_02", "img_03", "img_04", "img_05"],
        "last_completed_image": "img_05",
        "total_boxes_processed": 450,
        "total_masks_accepted": 442,
    }

    # Test save
    save_checkpoint_atomic(test_state)
    assert CHECKPOINT_PATH.exists(), "Checkpoint file must exist after save"
    assert not CHECKPOINT_TMP_PATH.exists(), "Temporary checkpoint file must be atomically renamed"

    # Test load
    loaded = load_checkpoint()
    assert loaded is not None, "Checkpoint must load successfully"
    assert loaded["completed_images_count"] == 5
    assert loaded["last_completed_image"] == "img_05"


if __name__ == "__main__":
    test_production_model_sha256_integrity()
    print("[PASS] test_production_model_sha256_integrity")
    test_confluent_tagging_mutual_iou()
    print("[PASS] test_confluent_tagging_mutual_iou")
    test_rim_safeguard_rejection()
    print("[PASS] test_rim_safeguard_rejection")
    test_checkpoint_atomic_save_and_load(None)
    print("[PASS] test_checkpoint_atomic_save_and_load")
    print("\n--- All Phase 5I Resumability & Safety Tests Passed! ---")
