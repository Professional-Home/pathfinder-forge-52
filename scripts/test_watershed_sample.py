"""Phase 5G — Classical Watershed Polarity Diagnostic Smoke Test.

Diagnostic smoke-test evaluating classical distance-transform watershed
across both standard Otsu threshold polarity variants:
- Binary (THRESH_BINARY + THRESH_OTSU)
- Binary Inverse (THRESH_BINARY_INV + THRESH_OTSU)

NOTICE:
This is a diagnostic smoke-test for evaluating classical thresholding limitations.
It is NOT a production algorithm and must not use ground-truth counts to make
per-image oracle decisions.
"""

from pathlib import Path
from typing import Tuple

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
VAL_IMAGES_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "val"
VAL_LABELS_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "val"

# Six representative validation plates spanning low to ultra-high density
TEST_STEMS = [
    "sp01_img01",  # Low density (GT: 4)
    "sp03_img07",  # Low density (GT: 19)
    "sp04_img03",  # Medium density (GT: 50)
    "sp05_img11",  # Medium/High density (GT: 146)
    "sp06_img30",  # High density (GT: 255)
    "sp10_img20",  # Ultra-high density / Confluent (GT: 572)
]


def run_watershed(img_bgr: np.ndarray, binary_fg: np.ndarray) -> Tuple[int, float]:
    """Applies morphological cleanup, Euclidean distance transform, and marker watershed."""
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(binary_fg, cv2.MORPH_OPEN, kernel, iterations=2)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    max_dist = float(dist_transform.max())

    if max_dist < 1e-3:
        return 0, max_dist

    # Local maxima markers thresholded at 20% of max distance
    ret, sure_fg = cv2.threshold(dist_transform, 0.20 * max_dist, 255, 0)
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # Label connected components
    ret, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    # Execute watershed
    markers = cv2.watershed(img_bgr.copy(), markers)
    unique_markers = np.unique(markers)
    # Exclude boundary (-1) and background (1)
    colony_count = len([m for m in unique_markers if m > 1])
    return colony_count, max_dist


def main():
    print("\n" + "=" * 90)
    print(" Phase 5G: Classical Watershed Polarity Diagnostic Smoke Test")
    print(" (Diagnostic evaluation only — not a production algorithm)")
    print("=" * 90)

    print(f"{'Image Stem':<14} | {'GT':<5} | {'Binary Otsu':<13} | {'MaxDist':<8} | {'Binary Inv Otsu':<16} | {'MaxDist':<8}")
    print("-" * 90)

    for stem in TEST_STEMS:
        img_path = VAL_IMAGES_DIR / f"{stem}.jpg"
        label_path = VAL_LABELS_DIR / f"{stem}.txt"

        # Robust file existence validation
        if not img_path.exists():
            print(f"[ERROR] Image file not found: {img_path}")
            continue

        gt_count = 0
        if label_path.exists():
            with open(label_path, "r", encoding="utf-8") as f:
                gt_count = len([l for l in f if l.strip()])
        else:
            print(f"[WARNING] Ground-truth label file not found: {label_path}")

        img = cv2.imread(str(img_path))
        if img is None:
            print(f"[ERROR] Failed to decode image: {img_path}")
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)

        # 1. Standard Binary Otsu (assumes colonies brighter than agar)
        _, thresh_bin = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        cnt_bin, dist_bin = run_watershed(img, thresh_bin)

        # 2. Binary Inverse Otsu (assumes colonies darker than agar)
        _, thresh_inv = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        cnt_inv, dist_inv = run_watershed(img, thresh_inv)

        err_bin = cnt_bin - gt_count
        err_inv = cnt_inv - gt_count

        bin_str = f"{cnt_bin:4d} ({err_bin:+4d})"
        inv_str = f"{cnt_inv:4d} ({err_inv:+4d})"

        print(
            f"{stem:<14} | {gt_count:<5d} | {bin_str:<13} | {dist_bin:<8.1f} | {inv_str:<16} | {dist_inv:<8.1f}"
        )

    print("-" * 90)
    print("Diagnostic Observations:")
    print("1. Binary Otsu assumes colonies are brighter than agar background.")
    print("2. Binary Inverse Otsu assumes colonies are darker than agar background.")
    print("3. Neither polarity variant reliably isolates colonies across different species")
    print("   or solves crowded/confluent plates without severe over- or under-segmentation.")
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
