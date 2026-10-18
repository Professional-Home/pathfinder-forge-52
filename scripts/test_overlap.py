"""Phase 5G — Colony Overlap & Confluence Quality Verification.

Verifies the deterministic colony overlap ratio and confluence risk logic
across both a 20-image smoke test and the complete 55-image validation split.

Threshold Specification:
- Overlap qualifying cutoff: IoU > 0.10
- Self-overlap excluded
- Overlap ratio: (number of detections with >= 1 qualifying overlap) / (total detections)
- Confluence risk:
  - High: overlap_ratio >= 0.40 OR (count > 100 AND overlap_ratio >= 0.25)
  - Medium: overlap_ratio >= 0.15 OR (count > 50 AND overlap_ratio >= 0.10)
  - Low: otherwise
"""

import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from ultralytics import YOLO

# Add services/colony-detector to sys.path to import production detector logic
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "services" / "colony-detector"))

from app.detector import assess_colony_quality
from app.schemas import ColonyDetection

MODEL_PATH = BASE_DIR / "services" / "colony-detector" / "models" / "best.pt"
VAL_IMAGES_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "val"
VAL_LABELS_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "val"

IOU_THRESHOLD = 0.10


def compute_overlap_ratio_vectorized(boxes: np.ndarray) -> float:
    """Computes overlap ratio using vectorized pairwise IoU > 0.10 excluding self."""
    n = len(boxes)
    if n <= 1:
        return 0.0

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)

    overlaps = np.zeros(n, dtype=bool)
    for i in range(n):
        xx1 = np.maximum(x1[i], x1)
        yy1 = np.maximum(y1[i], y1)
        xx2 = np.minimum(x2[i], x2)
        yy2 = np.minimum(y2[i], y2)
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        union = areas[i] + areas - inter
        iou = inter / np.maximum(union, 1e-6)
        iou[i] = 0.0  # Exclude self-overlap

        # Qualifying overlap threshold strictly IoU > 0.10
        if np.any(iou > IOU_THRESHOLD):
            overlaps[i] = True

    return round(float(np.sum(overlaps) / n), 3)


def evaluate_plates(
    image_paths: List[Path], model: YOLO, title: str
) -> List[Dict[str, Any]]:
    print(f"\n{'=' * 85}")
    print(f" {title} (Threshold: IoU > {IOU_THRESHOLD:.2f})")
    print(f"{'=' * 85}")

    results = []
    for idx, img_path in enumerate(image_paths, start=1):
        stem = img_path.stem
        label_path = VAL_LABELS_DIR / f"{stem}.txt"
        gt_count = 0
        if label_path.exists():
            with open(label_path, "r", encoding="utf-8") as f:
                gt_count = len([l for l in f if l.strip()])

        # Run inference at baseline locked settings (imgsz=640, conf=0.30)
        res = model.predict(source=str(img_path), conf=0.30, imgsz=640, verbose=False)[0]
        boxes = res.boxes.xyxy.cpu().numpy()
        confs = res.boxes.conf.cpu().numpy()
        n = len(boxes)

        # Convert to ColonyDetection schema to test production assess_colony_quality
        detections = [
            ColonyDetection(
                x1=float(boxes[i, 0]),
                y1=float(boxes[i, 1]),
                x2=float(boxes[i, 2]),
                y2=float(boxes[i, 3]),
                confidence=float(confs[i]),
                class_id=0,
                class_name="colony",
            )
            for i in range(n)
        ]

        quality = assess_colony_quality(detections)
        vectorized_overlap = compute_overlap_ratio_vectorized(boxes)

        # Parity check between production helper and vectorized computation
        assert abs(quality.overlap_ratio - vectorized_overlap) < 1e-4, (
            f"Parity mismatch on {stem}: {quality.overlap_ratio} vs {vectorized_overlap}"
        )

        item = {
            "stem": stem,
            "gt": gt_count,
            "pred": n,
            "overlap_ratio": quality.overlap_ratio,
            "density_level": quality.density_level,
            "confluence_risk": quality.confluence_risk,
            "review_recommended": quality.review_recommended,
            "warning_message": quality.warning_message,
        }
        results.append(item)

        rev_flag = "[REVIEW]" if item["review_recommended"] else "  [OK]  "
        print(
            f"[{idx:02d}/{len(image_paths):02d}] {stem:<12} | GT: {gt_count:3d} | Pred: {n:3d} | "
            f"Overlap: {item['overlap_ratio']:6.1%} | Tier: {item['density_level']:<10} | "
            f"Confluence: {item['confluence_risk']:<6} | {rev_flag}"
        )

    return results


def summarize_results(results: List[Dict[str, Any]], suite_name: str) -> None:
    n_total = len(results)
    overlaps = [r["overlap_ratio"] for r in results]
    mean_overlap = float(np.mean(overlaps))
    median_overlap = float(np.median(overlaps))

    tier_counts = {
        "low": sum(1 for r in results if r["density_level"] == "low"),
        "medium": sum(1 for r in results if r["density_level"] == "medium"),
        "high": sum(1 for r in results if r["density_level"] == "high"),
        "ultra_high": sum(1 for r in results if r["density_level"] == "ultra_high"),
    }

    confluence_counts = {
        "low": sum(1 for r in results if r["confluence_risk"] == "low"),
        "medium": sum(1 for r in results if r["confluence_risk"] == "medium"),
        "high": sum(1 for r in results if r["confluence_risk"] == "high"),
    }

    n_review = sum(1 for r in results if r["review_recommended"])

    print(f"\n--- {suite_name} Summary ---")
    print(f"Total Plates Checked:        {n_total}")
    print(f"Mean Overlap Ratio:          {mean_overlap:.2%}")
    print(f"Median Overlap Ratio:        {median_overlap:.2%}")
    print(f"Density Tier Distribution:   Low: {tier_counts['low']}, Medium: {tier_counts['medium']}, High: {tier_counts['high']}, Ultra-High: {tier_counts['ultra_high']}")
    print(f"Confluence Risk Breakdown:   Low: {confluence_counts['low']}, Medium: {confluence_counts['medium']}, High: {confluence_counts['high']}")
    print(f"Plates Flagged for Review:   {n_review} of {n_total} ({n_review / n_total:.1%})")

    # High overlap plates (overlap_ratio >= 30%)
    high_overlap = sorted(results, key=lambda x: x["overlap_ratio"], reverse=True)
    print("\nTop High-Overlap Plates:")
    for r in high_overlap[:6]:
        print(
            f"  - {r['stem']}: GT={r['gt']}, Pred={r['pred']}, Overlap={r['overlap_ratio']:.1%}, "
            f"Tier={r['density_level']}, ConfluenceRisk={r['confluence_risk']}, Review={r['review_recommended']}"
        )


def main():
    val_images = sorted(list(VAL_IMAGES_DIR.glob("*.jpg")))
    if not val_images:
        print(f"Error: No validation images found in {VAL_IMAGES_DIR}")
        sys.exit(1)

    print(f"Loaded {len(val_images)} validation plates. Initializing YOLO model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))

    # 1. 20-Image Quick Smoke Test
    smoke_results = evaluate_plates(
        val_images[:20], model, "20-Image Quick Smoke Test (IoU > 0.10)"
    )
    summarize_results(smoke_results, "20-Image Smoke Test")

    # 2. Complete 55-Image Full Validation Split
    full_results = evaluate_plates(
        val_images, model, "Full 55-Image Validation Verification (IoU > 0.10)"
    )
    summarize_results(full_results, "Full 55-Image Validation Split")


if __name__ == "__main__":
    main()
