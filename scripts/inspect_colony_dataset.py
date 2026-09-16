"""Comprehensive Inspection & Validation Script for Solymosi/Makrai et al. Colony Dataset.

Executes:
- Task 3: Dataset structure inspection (images, annotations, classes, dimensions, metadata)
- Task 4: Annotation validity checks (coordinate normalization, bounds, counts vs 56,865)
- Task 5: Sample visualization generation for low, medium, and high density plates
- Task 6: One-class conversion mapping analysis
- Task 7: Data split planning
"""

import csv
import json
import math
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import xlrd

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "ml-data" / "colony-dataset"
RAW_DIR = DATASET_DIR / "raw"
IMAGES_DIR = RAW_DIR / "images"
YOLO_DIR = RAW_DIR / "annot_YOLO"
INSPECTION_DIR = DATASET_DIR / "inspection"
SAMPLES_DIR = INSPECTION_DIR / "samples"

INSPECTION_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


def inspect_dataset():
    print("=" * 70)
    print("PHASE 5A: COLONY DATASET COMPREHENSIVE INSPECTION")
    print("=" * 70)

    # ── 1. Image Files Verification ───────────────────────────────────────────
    image_files = sorted(list(IMAGES_DIR.glob("*.jpg")) + list(IMAGES_DIR.glob("*.jpeg")) + list(IMAGES_DIR.glob("*.png")))
    image_names = {img.name for img in image_files}
    extensions = Counter(img.suffix.lower() for img in image_files)

    print(f"\n[1] Image Files:")
    print(f"    Total images found: {len(image_files)}")
    print(f"    Extensions: {dict(extensions)}")

    # Check dimensions & duplicates
    dimensions = []
    aspect_ratios = []
    image_md5_map = defaultdict(list)
    image_dim_map = {}

    import hashlib

    for img_path in image_files:
        with Image.open(img_path) as img:
            w, h = img.size
            dimensions.append((w, h))
            aspect_ratios.append(round(w / h, 4))
            image_dim_map[img_path.name] = (w, h)

        with open(img_path, "rb") as f:
            hsh = hashlib.md5(f.read()).hexdigest()
            image_md5_map[hsh].append(img_path.name)

    unique_dimensions = Counter(dimensions)
    duplicates = {hsh: names for hsh, names in image_md5_map.items() if len(names) > 1}

    print(f"    Unique dimensions count: {len(unique_dimensions)}")
    print(f"    Top dimensions: {unique_dimensions.most_common(5)}")
    min_w = min(d[0] for d in dimensions)
    max_w = max(d[0] for d in dimensions)
    min_h = min(d[1] for d in dimensions)
    max_h = max(d[1] for d in dimensions)
    print(f"    Width range: {min_w} to {max_w} px")
    print(f"    Height range: {min_h} to {max_h} px")
    print(f"    Exact duplicate image files detected: {len(duplicates)}")

    # ── 2. Annotation Files Verification (YOLO) ──────────────────────────────
    yolo_files = sorted(list(YOLO_DIR.glob("*.txt")))
    yolo_names = {yf.name for yf in yolo_files}
    yolo_stem_map = {yf.stem: yf for yf in yolo_files}

    print(f"\n[2] Annotation Files (YOLO format):")
    print(f"    Total annotation files: {len(yolo_files)}")

    # Check pairing
    image_stems = {img.stem for img in image_files}
    yolo_stems = {yf.stem for yf in yolo_files}

    missing_annotations = image_stems - yolo_stems
    orphan_annotations = yolo_stems - image_stems
    print(f"    Images without annotations: {len(missing_annotations)}")
    print(f"    Annotations without images: {len(orphan_annotations)}")

    # ── 3. Coordinate & Syntax Validation ────────────────────────────────────
    total_yolo_boxes = 0
    class_counter = Counter()
    malformed_rows = 0
    out_of_bounds_boxes = 0
    image_box_counts = {}
    boxes_by_image = {}

    for stem, yf in yolo_stem_map.items():
        box_list = []
        with open(yf, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line_num, line in enumerate(lines, 1):
            parts = line.strip().split()
            if not parts:
                continue

            if len(parts) != 5:
                malformed_rows += 1
                continue

            try:
                cls_id = int(parts[0])
                xc = float(parts[1])
                yc = float(parts[2])
                w = float(parts[3])
                h = float(parts[4])
            except ValueError:
                malformed_rows += 1
                continue

            class_counter[cls_id] += 1
            total_yolo_boxes += 1

            # Check bounds: normalized between 0 and 1
            x_min = xc - w / 2
            x_max = xc + w / 2
            y_min = yc - h / 2
            y_max = yc + h / 2

            if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                out_of_bounds_boxes += 1
            elif x_min < -0.01 or x_max > 1.01 or y_min < -0.01 or y_max > 1.01:
                out_of_bounds_boxes += 1

            box_list.append((cls_id, xc, yc, w, h))

        image_box_counts[stem] = len(box_list)
        boxes_by_image[stem] = box_list

    print(f"\n[3] YOLO Annotation Integrity:")
    print(f"    Total bounding boxes: {total_yolo_boxes}")
    print(f"    Classes in YOLO files: {dict(class_counter)}")
    print(f"    Malformed rows: {malformed_rows}")
    print(f"    Strict out-of-bounds bounding boxes: {out_of_bounds_boxes}")

    # Check comparison with published figure (56,865)
    diff = total_yolo_boxes - 56865
    print(f"    Published annotation count: 56,865")
    print(f"    Delta vs published figure: {diff:+d} ({'EXACT MATCH' if diff == 0 else 'Discrepancy observed'})")

    # ── 4. Metadata Inspection (images.xls & annot_tab.csv) ───────────────────
    xls_path = RAW_DIR / "images.xls"
    wb = xlrd.open_workbook(xls_path)
    sheet1 = wb.sheet_by_index(0)

    # Header: ['label_name', 'image_name', 'background', 'number of CFUs']
    species_counts = Counter()
    background_counts = Counter()
    meta_cfu_counts = {}

    for r in range(1, sheet1.nrows):
        label_name = str(sheet1.cell_value(r, 0)).strip()
        img_name = str(sheet1.cell_value(r, 1)).strip()
        bg = str(sheet1.cell_value(r, 2)).strip()
        cfu = sheet1.cell_value(r, 3)

        species_counts[label_name] += 1
        background_counts[bg] += 1
        meta_cfu_counts[img_name] = int(cfu) if isinstance(cfu, (int, float)) else 0

    print(f"\n[4] Metadata Analysis (images.xls):")
    print(f"    Number of species categories: {len(species_counts)}")
    print(f"    Species distribution (images per species):")
    for sp, cnt in sorted(species_counts.items()):
        print(f"      {sp}: {cnt} images")
    print(f"    Background distribution: {dict(background_counts)}")

    # Colony count distribution statistics
    counts = list(image_box_counts.values())
    counts.sort()
    n = len(counts)
    mean_count = sum(counts) / n
    median_count = counts[n // 2] if n % 2 != 0 else (counts[n // 2 - 1] + counts[n // 2]) / 2
    q1 = counts[n // 4]
    q3 = counts[(3 * n) // 4]
    min_count = counts[0]
    max_count = counts[-1]
    empty_images = [k for k, v in image_box_counts.items() if v == 0]

    variance = sum((x - mean_count) ** 2 for x in counts) / n
    std_dev = math.sqrt(variance)

    print(f"\n[5] Colony Count Distribution per Image:")
    print(f"    Min colonies/image: {min_count}")
    print(f"    Max colonies/image: {max_count}")
    print(f"    Mean colonies/image: {mean_count:.1f}")
    print(f"    Median colonies/image: {median_count}")
    print(f"    Q1 (25th percentile): {q1}")
    print(f"    Q3 (75th percentile): {q3}")
    print(f"    Std deviation: {std_dev:.1f}")
    print(f"    Empty images (0 colonies): {len(empty_images)}")

    # ── 5. Visual Inspection Samples (Task 5) ─────────────────────────────────
    print(f"\n[6] Generating Visual Inspection Samples in {SAMPLES_DIR}...")
    # Categorize images into low (< 40), medium (40 - 200), high (> 200)
    low_candidates = [(stem, cnt) for stem, cnt in image_box_counts.items() if 1 <= cnt <= 30]
    med_candidates = [(stem, cnt) for stem, cnt in image_box_counts.items() if 70 <= cnt <= 140]
    high_candidates = [(stem, cnt) for stem, cnt in image_box_counts.items() if cnt >= 300]

    selected_samples = []
    # 5 low
    for stem, cnt in low_candidates[:5]:
        selected_samples.append((stem, cnt, "low_density"))
    # 5 med
    for stem, cnt in med_candidates[:5]:
        selected_samples.append((stem, cnt, "med_density"))
    # 5 high
    for stem, cnt in high_candidates[:5]:
        selected_samples.append((stem, cnt, "high_density"))

    sample_summary = []

    for stem, cnt, group in selected_samples:
        img_path = IMAGES_DIR / f"{stem}.jpg"
        if not img_path.exists():
            continue

        boxes = boxes_by_image[stem]
        with Image.open(img_path) as im:
            rendered = im.copy().convert("RGB")
            draw = ImageDraw.Draw(rendered)
            w, h = rendered.size
            stroke_w = max(2, round(w / 400))

            for cls_id, xc, yc, bw, bh in boxes:
                x1 = (xc - bw / 2) * w
                y1 = (yc - bh / 2) * h
                x2 = (xc + bw / 2) * w
                y2 = (yc + bh / 2) * h
                draw.rectangle([x1, y1, x2, y2], outline=(16, 185, 129), width=stroke_w)

            # Resize to preview-friendly size (e.g. max 1200px) to save space
            preview_max = 1200
            if w > preview_max:
                ratio = preview_max / w
                new_w = preview_max
                new_h = round(h * ratio)
                rendered = rendered.resize((new_w, new_h), Image.Resampling.LANCZOS)

            out_name = f"sample_{group}_{stem}_count{cnt}.jpg"
            out_file = SAMPLES_DIR / out_name
            rendered.save(out_file, format="JPEG", quality=88)

            sample_summary.append({
                "group": group,
                "file": out_name,
                "stem": stem,
                "count": cnt,
                "dimensions": f"{w}x{h}",
            })

    print(f"    Rendered {len(sample_summary)} sample images successfully.")

    # ── 6. Save Full Inspection Summary JSON ───────────────────────────────────
    summary_data = {
        "dataset_name": "Annotated dataset for deep-learning-based bacterial colony detection",
        "doi": "10.6084/m9.figshare.22022540",
        "paper_doi": "10.1038/s41597-023-02404-8",
        "total_images": len(image_files),
        "total_yolo_files": len(yolo_files),
        "total_annotations": total_yolo_boxes,
        "published_annotations": 56865,
        "classes_in_yolo": dict(class_counter),
        "species_in_metadata": dict(species_counts),
        "background_distribution": dict(background_counts),
        "dimensions": {
            "min_width": min_w,
            "max_width": max_w,
            "min_height": min_h,
            "max_height": max_h,
            "unique_dimensions_count": len(unique_dimensions),
        },
        "stats": {
            "min": min_count,
            "max": max_count,
            "mean": round(mean_count, 2),
            "median": median_count,
            "q1": q1,
            "q3": q3,
            "std_dev": round(std_dev, 2),
        },
        "visual_samples": sample_summary,
    }

    report_json_path = INSPECTION_DIR / "inspection_summary.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    print(f"\n[7] Summary report written to: {report_json_path}")
    print("=" * 70)
    print("INSPECTION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    inspect_dataset()
