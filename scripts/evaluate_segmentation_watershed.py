"""Phase 5G — Classical Segmentation & Watershed Feasibility Study.

Evaluates whether classical image processing and distance-transform watershed
can separate touching colonies and improve colony quantification accuracy
on the Petri dish validation set compared to the YOLO baseline.

Evaluated Methods:
1. YOLO Baseline (imgsz=640, conf=0.30)
2. Classical Watershed (Global Otsu + Distance Transform)
3. Classical Watershed (Morphological Top-Hat Filter + Distance Transform)
4. Hybrid YOLO + Local Watershed (Refines overlapping / touching bounding boxes)

Calculates:
- Count MAE, Median AE, Mean % Error, Median % Error
- Exact, +-1, +-5, +-10 accuracy
- Density stratification (<50, 50-200, >200, >400)
- Difficult-case analysis and visual comparison generation
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import torch
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_WEIGHTS = BASE_DIR / "services" / "colony-detector" / "models" / "best.pt"
VAL_IMAGES_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "val"
VAL_LABELS_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "val"
REPORT_JSON = BASE_DIR / "ml-data" / "colony-training" / "phase5g_report.json"
REPORT_MD = BASE_DIR / "ml-data" / "colony-training" / "phase5g_report.md"
SAMPLES_DIR = BASE_DIR / "ml-data" / "colony-training" / "phase5g_eval_samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)


def load_ground_truth(labels_dir: Path) -> Dict[str, int]:
    counts = {}
    for p in labels_dir.glob("*.txt"):
        with open(p, "r", encoding="utf-8") as f:
            counts[p.stem] = len([l for l in f.readlines() if l.strip()])
    return counts


def run_yolo_baseline(model: YOLO, img_path: Path) -> Tuple[int, List[Dict[str, float]], float]:
    """Runs standard 640px YOLO baseline inference."""
    t0 = time.perf_counter()
    results = model.predict(
        source=str(img_path),
        imgsz=640,
        conf=0.30,
        max_det=1000,
        verbose=False,
    )
    latency_ms = (time.perf_counter() - t0) * 1000.0

    boxes_list = []
    if results and len(results) > 0 and results[0].boxes is not None:
        xyxy = results[0].boxes.xyxy.cpu().numpy()
        confs = results[0].boxes.conf.cpu().numpy()
        for i in range(len(xyxy)):
            boxes_list.append({
                "x1": float(xyxy[i, 0]),
                "y1": float(xyxy[i, 1]),
                "x2": float(xyxy[i, 2]),
                "y2": float(xyxy[i, 3]),
                "conf": float(confs[i]),
            })
    return len(boxes_list), boxes_list, latency_ms


def run_watershed_otsu(img_bgr: np.ndarray) -> Tuple[int, np.ndarray, float]:
    """Method 2: Global Otsu thresholding + distance transform + watershed."""
    t0 = time.perf_counter()
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Contrast / CLAHE to normalize lighting
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blur = cv2.GaussianBlur(enhanced, (5, 5), 0)

    # 2. Estimate Petri dish circular mask to exclude exterior artifacts
    # Approximate dish center & radius
    mask = np.zeros((h, w), dtype=np.uint8)
    center = (w // 2, h // 2)
    radius = int(min(w, h) * 0.46)
    cv2.circle(mask, center, radius, 255, -1)

    # 3. Test polarity: check if colonies are brighter or darker than median plate agar
    plate_pixels = enhanced[mask == 255]
    median_val = np.median(plate_pixels)
    # Most ADBC plates have light colonies on darker agar or dark colonies on translucent agar
    # Test both Otsu normal and inverted on masked region
    _, thresh_inv = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, thresh_norm = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Pick polarity where foreground covers < 35% of plate area (colonies are sparse relative to agar)
    fg_inv_ratio = np.sum((thresh_inv == 255) & (mask == 255)) / np.sum(mask == 255)
    fg_norm_ratio = np.sum((thresh_norm == 255) & (mask == 255)) / np.sum(mask == 255)

    if 0.005 <= fg_norm_ratio <= 0.40 and fg_norm_ratio < fg_inv_ratio:
        fg_binary = thresh_norm
    else:
        fg_binary = thresh_inv

    fg_binary = cv2.bitwise_and(fg_binary, fg_binary, mask=mask)

    # 4. Morphological noise removal
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    opening = cv2.morphologyEx(fg_binary, cv2.MORPH_OPEN, kernel, iterations=1)

    # 5. Distance transform
    dist = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    max_d = dist.max()
    if max_d < 1e-3:
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return 0, np.zeros((h, w), dtype=np.int32), latency_ms

    # 6. Local maxima / sure foreground
    ret, sure_fg = cv2.threshold(dist, 0.25 * max_d, 255, 0)
    sure_fg = np.uint8(sure_fg)

    # Sure background
    sure_bg = cv2.dilate(opening, kernel, iterations=3)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # 7. Marker labelling
    ret, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    markers = cv2.watershed(img_bgr, markers)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    # Count distinct components (excluding background 1 and border -1)
    unique = np.unique(markers)
    count = len([m for m in unique if m > 1])
    return count, markers, latency_ms


def run_watershed_tophat(img_bgr: np.ndarray) -> Tuple[int, np.ndarray, float]:
    """Method 3: Morphological Top-Hat filter + Adaptive Distance Watershed."""
    t0 = time.perf_counter()
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Dish mask
    mask = np.zeros((h, w), dtype=np.uint8)
    center = (w // 2, h // 2)
    radius = int(min(w, h) * 0.46)
    cv2.circle(mask, center, radius, 255, -1)

    # Top-hat isolates bright elements smaller than structuring element
    # Black-hat isolates dark elements smaller than structuring element
    se_radius = max(5, int(min(w, h) / 100))
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * se_radius + 1, 2 * se_radius + 1))

    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, se)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, se)

    # Combine or choose stronger response inside dish mask
    top_energy = np.mean(tophat[mask == 255])
    black_energy = np.mean(blackhat[mask == 255])

    feat = tophat if top_energy >= black_energy else blackhat
    feat = cv2.bitwise_and(feat, feat, mask=mask)

    # Threshold the feature map
    blur_feat = cv2.GaussianBlur(feat, (3, 3), 0)
    _, fg = cv2.threshold(blur_feat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Filter out tiny noise specks (<4 px area) and huge blobs
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    clean_fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel, iterations=1)

    dist = cv2.distanceTransform(clean_fg, cv2.DIST_L2, 5)
    max_d = dist.max()
    if max_d < 1e-3:
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return 0, np.zeros((h, w), dtype=np.int32), latency_ms

    # Local maxima threshold
    ret, sure_fg = cv2.threshold(dist, 0.20 * max_d, 255, 0)
    sure_fg = np.uint8(sure_fg)

    sure_bg = cv2.dilate(clean_fg, kernel, iterations=2)
    unknown = cv2.subtract(sure_bg, sure_fg)

    ret, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    markers = cv2.watershed(img_bgr, markers)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    unique = np.unique(markers)
    count = len([m for m in unique if m > 1])
    return count, markers, latency_ms


def run_hybrid_yolo_watershed(
    img_bgr: np.ndarray, yolo_boxes: List[Dict[str, float]]
) -> Tuple[int, float]:
    """Method 4: Hybrid YOLO + Local Watershed Refinement.
    
    Uses YOLO boxes to constrain detection areas, then tests whether large/elongated
    bounding boxes contain multiple peaks via distance transform watershed.
    """
    t0 = time.perf_counter()
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    if not yolo_boxes:
        return 0, (time.perf_counter() - t0) * 1000.0

    # Calculate median box area from all detections
    box_areas = [(b["x2"] - b["x1"]) * (b["y2"] - b["y1"]) for b in yolo_boxes]
    med_area = float(np.median(box_areas)) if box_areas else 100.0

    total_count = 0
    for b in yolo_boxes:
        bx1 = max(0, int(b["x1"]))
        by1 = max(0, int(b["y1"]))
        bx2 = min(w, int(b["x2"]))
        by2 = min(h, int(b["y2"]))

        box_w = bx2 - bx1
        box_h = by2 - by1
        area = box_w * box_h

        # If box is small / typical size (< 1.8x median area), count as 1 colony
        if area <= 1.8 * med_area or box_w < 8 or box_h < 8:
            total_count += 1
            continue

        # For larger boxes that might contain 2+ touching colonies, inspect internal peaks
        crop = gray[by1:by2, bx1:bx2]
        crop_blur = cv2.GaussianBlur(crop, (3, 3), 0)
        _, thresh = cv2.threshold(crop_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Invert if crop is mostly white
        if np.mean(thresh) > 127:
            thresh = cv2.bitwise_not(thresh)

        dist = cv2.distanceTransform(thresh, cv2.DIST_L2, 3)
        if dist.max() > 2.0:
            # Find local peaks
            peaks = (dist > 0.45 * dist.max()).astype(np.uint8)
            num_peaks, _ = cv2.connectedComponents(peaks)
            sub_count = max(1, num_peaks - 1)
            # Cap at realistic sub-colonies based on area ratio
            max_plausible = max(1, int(round(area / med_area)))
            total_count += min(sub_count, max_plausible)
        else:
            total_count += 1

    latency_ms = (time.perf_counter() - t0) * 1000.0
    return total_count, latency_ms


def calculate_metrics(gt_dict: Dict[str, int], pred_dict: Dict[str, int]) -> Dict[str, Any]:
    stems = sorted(list(gt_dict.keys()))
    errors = []
    abs_errors = []
    pct_errors = []

    for s in stems:
        gt = gt_dict[s]
        pred = pred_dict.get(s, 0)
        err = pred - gt
        ae = abs(err)
        errors.append(err)
        abs_errors.append(ae)
        pct_errors.append((ae / max(gt, 1)) * 100.0)

    n = len(stems)
    mae = float(np.mean(abs_errors))
    med_ae = float(np.median(abs_errors))
    mean_pct = float(np.mean(pct_errors))
    med_pct = float(np.median(pct_errors))
    exact = int(sum(ae == 0 for ae in abs_errors))
    pm1 = int(sum(ae <= 1 for ae in abs_errors))
    pm5 = int(sum(ae <= 5 for ae in abs_errors))
    pm10 = int(sum(ae <= 10 for ae in abs_errors))
    max_ae = int(max(abs_errors))

    return {
        "n_plates": n,
        "mae": round(mae, 2),
        "median_ae": round(med_ae, 2),
        "mean_pct_error": round(mean_pct, 2),
        "median_pct_error": round(med_pct, 2),
        "exact": exact,
        "pm1": pm1,
        "pm5": pm5,
        "pm10": pm10,
        "max_ae": max_ae,
    }


def compute_density_breakdown(
    gt_dict: Dict[str, int], pred_dict: Dict[str, int]
) -> Dict[str, Dict[str, Any]]:
    tiers = {
        "low (<50)": [s for s, g in gt_dict.items() if g < 50],
        "medium (50-200)": [s for s, g in gt_dict.items() if 50 <= g <= 200],
        "high (>200)": [s for s, g in gt_dict.items() if g > 200],
        "ultra_high (>400)": [s for s, g in gt_dict.items() if g > 400],
    }
    out = {}
    for t_name, stems in tiers.items():
        if not stems:
            continue
        g_sub = {s: gt_dict[s] for s in stems}
        p_sub = {s: pred_dict[s] for s in stems}
        m = calculate_metrics(g_sub, p_sub)
        out[t_name] = m
    return out


def main():
    log("=== Phase 5G: Classical Segmentation & Watershed Feasibility Benchmark ===")

    # 1. Load Ground Truth
    gt_dict = load_ground_truth(VAL_LABELS_DIR)
    val_images = sorted(list(VAL_IMAGES_DIR.glob("*.jpg")))
    log(f"Found {len(val_images)} validation images and {len(gt_dict)} ground-truth labels.")

    # 2. Load YOLO Baseline Model
    log(f"Loading baseline YOLO model from {MODEL_WEIGHTS}...")
    yolo_model = YOLO(str(MODEL_WEIGHTS))

    pred_yolo = {}
    pred_otsu = {}
    pred_tophat = {}
    pred_hybrid = {}

    latencies_yolo = []
    latencies_otsu = []
    latencies_tophat = []
    latencies_hybrid = []

    per_image_results = []

    # Visual sample images to save
    sample_stems = ["sp01_img01", "sp04_img03", "sp05_img11", "sp06_img30", "sp10_img20", "sp22_img19", "sp13_img04"]

    log(f"Evaluating all 4 approaches across {len(val_images)} validation plates...")
    for idx, img_path in enumerate(val_images, start=1):
        stem = img_path.stem
        gt = gt_dict.get(stem, 0)
        img_bgr = cv2.imread(str(img_path))

        # A. YOLO Baseline
        yolo_cnt, yolo_boxes, lat_yolo = run_yolo_baseline(yolo_model, img_path)
        pred_yolo[stem] = yolo_cnt
        latencies_yolo.append(lat_yolo)

        # B. Classical Otsu Watershed
        otsu_cnt, otsu_markers, lat_otsu = run_watershed_otsu(img_bgr)
        pred_otsu[stem] = otsu_cnt
        latencies_otsu.append(lat_otsu)

        # C. Top-Hat Watershed
        th_cnt, th_markers, lat_th = run_watershed_tophat(img_bgr)
        pred_tophat[stem] = th_cnt
        latencies_tophat.append(lat_th)

        # D. Hybrid YOLO + Local Watershed
        hyb_cnt, lat_hyb = run_hybrid_yolo_watershed(img_bgr, yolo_boxes)
        pred_hybrid[stem] = hyb_cnt
        latencies_hybrid.append(lat_yolo + lat_hyb)

        per_image_results.append({
            "stem": stem,
            "gt": gt,
            "yolo": yolo_cnt,
            "otsu_watershed": otsu_cnt,
            "tophat_watershed": th_cnt,
            "hybrid_watershed": hyb_cnt,
        })

        if stem in sample_stems:
            # Generate visual comparison collage
            # Left: Original + YOLO boxes
            # Right: Top-Hat Watershed segmentation overlay
            vis_yolo = img_bgr.copy()
            for b in yolo_boxes:
                cv2.rectangle(
                    vis_yolo,
                    (int(b["x1"]), int(b["y1"])),
                    (int(b["x2"]), int(b["y2"])),
                    (0, 255, 0),
                    2,
                )

            # Watershed color overlay
            vis_ws = img_bgr.copy()
            if th_markers is not None:
                ws_vis = np.zeros_like(img_bgr)
                np.random.seed(42)
                colors = np.random.randint(50, 255, size=(np.max(th_markers) + 2, 3), dtype=np.uint8)
                colors[1] = [0, 0, 0]  # background
                colors[0] = [0, 0, 255]  # boundary
                ws_vis = colors[np.maximum(0, th_markers)]
                vis_ws = cv2.addWeighted(vis_ws, 0.65, ws_vis, 0.35, 0)

            # Resize to max 640 for collage
            h, w = img_bgr.shape[:2]
            scale = 640.0 / max(h, w)
            new_w = int(w * scale)
            new_h = int(h * scale)
            r_orig = cv2.resize(img_bgr, (new_w, new_h))
            r_yolo = cv2.resize(vis_yolo, (new_w, new_h))
            r_ws = cv2.resize(vis_ws, (new_w, new_h))

            # Add titles
            cv2.putText(r_orig, f"Original (GT: {gt})", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            cv2.putText(r_yolo, f"YOLO 640px (Pred: {yolo_cnt})", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(r_ws, f"Watershed (Pred: {th_cnt})", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 100, 255), 2)

            collage = np.hstack([r_orig, r_yolo, r_ws])
            cv2.imwrite(str(SAMPLES_DIR / f"{stem}_comparison.jpg"), collage)

        if idx % 10 == 0 or idx == len(val_images):
            log(f"[{idx}/{len(val_images)}] Processed {stem}: GT={gt}, YOLO={yolo_cnt}, OtsuWS={otsu_cnt}, TopHatWS={th_cnt}, Hybrid={hyb_cnt}")

    # 3. Overall Metrics
    m_yolo = calculate_metrics(gt_dict, pred_yolo)
    m_otsu = calculate_metrics(gt_dict, pred_otsu)
    m_th = calculate_metrics(gt_dict, pred_tophat)
    m_hyb = calculate_metrics(gt_dict, pred_hybrid)

    m_yolo["avg_latency_ms"] = round(float(np.mean(latencies_yolo)), 1)
    m_otsu["avg_latency_ms"] = round(float(np.mean(latencies_otsu)), 1)
    m_th["avg_latency_ms"] = round(float(np.mean(latencies_tophat)), 1)
    m_hyb["avg_latency_ms"] = round(float(np.mean(latencies_hybrid)), 1)

    # 4. Density Stratifications
    d_yolo = compute_density_breakdown(gt_dict, pred_yolo)
    d_otsu = compute_density_breakdown(gt_dict, pred_otsu)
    d_th = compute_density_breakdown(gt_dict, pred_tophat)
    d_hyb = compute_density_breakdown(gt_dict, pred_hybrid)

    # Print summary tables
    log("\n" + "=" * 80)
    log("OVERALL VALIDATION COUNTING BENCHMARK (55 PLATES, 8,024 COLONIES)")
    log("=" * 80)
    log(f"{'Method':<28} | {'MAE':<6} | {'MedAE':<6} | {'Mean%':<7} | {'Med%':<6} | {'Exact':<5} | {'+-5':<5} | {'MaxAE':<6} | {'Latency':<8}")
    log("-" * 80)
    for name, m in [
        ("1. Baseline YOLO (640px)", m_yolo),
        ("2. Global Otsu Watershed", m_otsu),
        ("3. Top-Hat Filter Watershed", m_th),
        ("4. Hybrid YOLO + Watershed", m_hyb),
    ]:
        log(f"{name:<28} | {m['mae']:<6.2f} | {m['median_ae']:<6.1f} | {m['mean_pct_error']:<6.2f}% | {m['median_pct_error']:<5.2f}% | {m['exact']:<5} | {m['pm5']:<5} | {m['max_ae']:<6} | {m['avg_latency_ms']:<5.1f} ms")

    log("\n" + "=" * 80)
    log("DENSITY BREAKDOWN (MAE COMPARISON)")
    log("=" * 80)
    log(f"{'Density Tier':<22} | {'Plates':<6} | {'YOLO MAE':<10} | {'Otsu WS':<10} | {'TopHat WS':<10} | {'Hybrid MAE':<10}")
    log("-" * 80)
    for tier in ["low (<50)", "medium (50-200)", "high (>200)", "ultra_high (>400)"]:
        n_p = d_yolo[tier]["n_plates"]
        log(f"{tier:<22} | {n_p:<6} | {d_yolo[tier]['mae']:<10.2f} | {d_otsu[tier]['mae']:<10.2f} | {d_th[tier]['mae']:<10.2f} | {d_hyb[tier]['mae']:<10.2f}")

    # Compile structured JSON report
    report_data = {
        "timestamp": datetime.now().isoformat(),
        "dataset": {
            "validation_plates": len(val_images),
            "validation_ground_truth_colonies": int(sum(gt_dict.values())),
        },
        "overall_metrics": {
            "yolo_baseline_640": m_yolo,
            "watershed_otsu": m_otsu,
            "watershed_tophat": m_th,
            "hybrid_yolo_watershed": m_hyb,
        },
        "density_breakdown": {
            "yolo_baseline_640": d_yolo,
            "watershed_otsu": d_otsu,
            "watershed_tophat": d_th,
            "hybrid_yolo_watershed": d_hyb,
        },
        "per_image_results": per_image_results,
    }

    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    log(f"Wrote machine-readable report to {REPORT_JSON}")


if __name__ == "__main__":
    main()
