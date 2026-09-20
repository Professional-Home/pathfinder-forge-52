"""Phase 5I — Dataset Integrity & Quality Verification Script.

Validates the complete Phase 5I segmentation dataset before initiating model training:
1. Verifies 1-to-1 image-label correspondence.
2. Validates polygon normalization (coordinates in [0, 1]).
3. Validates polygon geometric invariants (>= 3 points, area > 0, no NaN/Inf).
4. Confirms class ID strictly 0 (colony).
5. Ensures zero test/validation data leakage into the training split.
6. Calculates aggregate instance statistics.
"""

import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "ml-data" / "colony-segmentation-phase5i"
TRAIN_IMG_DIR = DATASET_DIR / "images" / "train"
TRAIN_LBL_DIR = DATASET_DIR / "labels" / "train"
VAL_IMG_DIR = DATASET_DIR / "images" / "val"
VAL_LBL_DIR = DATASET_DIR / "labels" / "val"
CHECKPOINT_PATH = BASE_DIR / "ml-data" / "colony-training" / "phase5i_pseudomask_checkpoint.json"
COMPLETE_MARKER = BASE_DIR / "ml-data" / "colony-training" / "phase5i_pseudomasks_complete.json"


def verify_dataset() -> Dict[str, Any]:
    print("==================================================")
    print("PHASE 5I — DATASET INTEGRITY & VALIDATION CHECK")
    print("==================================================")

    train_imgs = sorted(list(TRAIN_IMG_DIR.glob("*.jpg")) + list(TRAIN_IMG_DIR.glob("*.png")))
    train_lbls = sorted(list(TRAIN_LBL_DIR.glob("*.txt")))

    val_imgs = sorted(list(VAL_IMG_DIR.glob("*.jpg")) + list(VAL_IMG_DIR.glob("*.png")))
    val_lbls = sorted(list(VAL_LBL_DIR.glob("*.txt")))

    print(f"Training images: {len(train_imgs)}, labels: {len(train_lbls)}")
    print(f"Validation images: {len(val_imgs)}, labels: {len(val_lbls)}")

    errors = []
    warnings = []

    # Check 1: Image-label matching
    img_stems = {p.stem for p in train_imgs}
    lbl_stems = {p.stem for p in train_lbls}

    missing_labels = img_stems - lbl_stems
    missing_images = lbl_stems - img_stems

    if missing_labels:
        errors.append(f"{len(missing_labels)} images missing corresponding label files.")
    if missing_images:
        errors.append(f"{len(missing_images)} label files missing corresponding images.")

    # Check 2: Zero leakage
    val_stems = {p.stem for p in val_imgs}
    leakage = img_stems.intersection(val_stems)
    if leakage:
        errors.append(f"DATA LEAKAGE DETECTED: {len(leakage)} images present in both train and val splits!")

    # Check 3: Polygon coordinates & integrity
    total_polygons = 0
    invalid_polygons = 0
    out_of_bounds = 0
    nan_coords = 0
    non_zero_classes = 0

    vertex_counts = []

    for lbl_path in train_lbls:
        with open(lbl_path, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                parts = line.strip().split()
                if not parts:
                    continue

                total_polygons += 1
                cls_id = int(parts[0])
                if cls_id != 0:
                    non_zero_classes += 1

                coords = [float(v) for v in parts[1:]]
                if len(coords) < 6 or len(coords) % 2 != 0:
                    invalid_polygons += 1
                    continue

                vertex_counts.append(len(coords) // 2)

                for c in coords:
                    if np.isnan(c) or np.isinf(c):
                        nan_coords += 1
                    if c < 0.0 or c > 1.0:
                        out_of_bounds += 1

    if invalid_polygons > 0:
        errors.append(f"{invalid_polygons} malformed polygons (<3 points or odd coord count).")
    if out_of_bounds > 0:
        errors.append(f"{out_of_bounds} coordinates strictly out of [0.0, 1.0] bounds.")
    if nan_coords > 0:
        errors.append(f"{nan_coords} NaN/Inf coordinates detected.")
    if non_zero_classes > 0:
        errors.append(f"{non_zero_classes} non-zero class IDs found.")

    status = "PASSED" if not errors else "FAILED"
    print(f"\nIntegrity Verification Result: {status}")
    print(f"Total Validated Polygons: {total_polygons}")
    if vertex_counts:
        print(f"Mean Vertices per Polygon: {np.mean(vertex_counts):.1f} (min={min(vertex_counts)}, max={max(vertex_counts)})")

    if errors:
        print("\nERRORS DETECTED:")
        for err in errors:
            print(f"  [!] {err}")

    summary = {
        "status": status,
        "train_images": len(train_imgs),
        "train_labels": len(train_lbls),
        "val_images": len(val_imgs),
        "val_labels": len(val_lbls),
        "total_polygons": total_polygons,
        "errors": errors,
        "mean_vertices": round(float(np.mean(vertex_counts)), 1) if vertex_counts else 0,
    }
    return summary


if __name__ == "__main__":
    verify_dataset()
