"""Train the First Baseline YOLO Colony Detection Model (Phase 5C).

Configuration:
- Model: yolo11n.pt (lightweight pretrained YOLO11 detection)
- Dataset: ml-data/colony-dataset/processed_yolo/data.yaml (1 class: colony)
- Epochs: 100
- Imgsz: 640
- Batch: 4 (safe for 2-core CPU)
- Seed: 42
- Patience: 20
- Workers: 0 (Windows safe)
- Device: cpu
- Evaluation: Validation set, Test set, and Colony Counting Evaluation (confidence=0.30)
"""

import json
import math
import os
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import torch
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

# Project paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_YAML = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "data.yaml"
PRETRAINED_WEIGHTS = BASE_DIR / "ml-data" / "colony-training" / "yolo11n.pt"
RUNS_DIR = BASE_DIR / "ml-data" / "colony-training" / "runs"
EXPERIMENT_NAME = "baseline-yolo11n-640"
REPORT_JSON = BASE_DIR / "ml-data" / "colony-training" / "baseline_training_report.json"
SAMPLES_DIR = RUNS_DIR / EXPERIMENT_NAME / "visual_eval_samples"

# Baseline hyperparameter settings
EPOCHS = 100
IMGSZ = 640
BATCH_SIZE = 4
SEED = 42
PATIENCE = 20
WORKERS = 0
CONFIDENCE_THRESHOLD = 0.30
MAX_DET = 747


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)


def train_baseline():
    log("=" * 70)
    log("PHASE 5C: TRAINING BASELINE YOLO11N COLONY DETECTION MODEL")
    log("=" * 70)

    # 1. Verify Environment
    python_ver = sys.version.split()[0]
    torch_ver = torch.__version__
    cuda_avail = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU (Intel Core i3-10110U)"
    cuda_ver = torch.version.cuda if cuda_avail else "N/A"

    log("Environment:")
    log(f"  Python:     {python_ver}")
    log(f"  PyTorch:    {torch_ver}")
    log(f"  Device:     {device_name} (CUDA available: {cuda_avail})")
    log(f"  Weights:    {PRETRAINED_WEIGHTS}")
    log(f"  Data YAML:  {DATASET_YAML}")
    log(f"  Epochs:     {EPOCHS} (patience={PATIENCE})")
    log(f"  Image Size: {IMGSZ} (Batch Size: {BATCH_SIZE})")

    # Ensure pretrained weights exist
    if not PRETRAINED_WEIGHTS.exists():
        log(f"Pretrained weights missing at {PRETRAINED_WEIGHTS}, downloading yolo11n.pt...")
        temp_m = YOLO("yolo11n.pt")
        temp_m.export(format="torchscript")  # harmless check
        if Path("yolo11n.pt").exists():
            PRETRAINED_WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
            Path("yolo11n.pt").rename(PRETRAINED_WEIGHTS)

    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Train Model
    t_train_start = time.time()
    last_weight_path = RUNS_DIR / EXPERIMENT_NAME / "weights" / "last.pt"

    if last_weight_path.exists():
        log(f"\nFound existing checkpoint at {last_weight_path}. Resuming training from last epoch...")
        model = YOLO(str(last_weight_path))
        train_results = model.train(resume=True)
    else:
        log("\nStarting model training from pretrained weights...")
        model = YOLO(str(PRETRAINED_WEIGHTS))
        train_results = model.train(
            data=str(DATASET_YAML),
            epochs=EPOCHS,
            imgsz=IMGSZ,
            batch=BATCH_SIZE,
            seed=SEED,
            patience=PATIENCE,
            workers=WORKERS,
            cache=True,
            device="cpu",
            max_det=MAX_DET,
            project=str(RUNS_DIR),
            name=EXPERIMENT_NAME,
            exist_ok=True,
            verbose=True,
        )

    t_train_end = time.time()
    train_duration_sec = round(t_train_end - t_train_start, 2)
    # Total accumulated training time across all 3 sessions
    total_duration_sec = round(train_duration_sec + 14976.3 + 26118.8, 2)
    log(f"\nTraining session completed in {train_duration_sec:.1f}s ({train_duration_sec/3600:.2f} hours)")
    log(f"Total accumulated training time: {total_duration_sec:.1f}s ({total_duration_sec/3600:.2f} hours)")

    exp_dir = RUNS_DIR / EXPERIMENT_NAME
    best_weight_path = exp_dir / "weights" / "best.pt"
    last_weight_path = exp_dir / "weights" / "last.pt"

    if not best_weight_path.exists():
        log(f"WARNING: {best_weight_path} not found. Falling back to last.pt")
        best_weight_path = last_weight_path

    best_model_size_mb = round(best_weight_path.stat().st_size / (1024 * 1024), 2)
    log(f"Best model saved at: {best_weight_path} ({best_model_size_mb} MB)")

    # Read training results CSV if available to identify best epoch and completed epochs
    csv_path = exp_dir / "results.csv"
    best_epoch = 1
    total_epochs_completed = 1
    if csv_path.exists():
        with open(csv_path, "r") as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
        if len(lines) > 1:
            total_epochs_completed = len(lines) - 1
            # Header usually has epoch and metrics
            header = [h.strip() for h in lines[0].split(",")]
            # Find best epoch by highest metrics/mAP50(B)
            map50_idx = -1
            for idx, h in enumerate(header):
                if "metrics/mAP50(B)" in h:
                    map50_idx = idx
                    break
            if map50_idx != -1:
                best_map = -1.0
                for row_idx, line in enumerate(lines[1:], 1):
                    cols = [c.strip() for c in line.split(",")]
                    if len(cols) > map50_idx:
                        try:
                            v = float(cols[map50_idx])
                            if v > best_map:
                                best_map = v
                                best_epoch = int(cols[0])
                        except ValueError:
                            pass

    log(f"Total epochs completed: {total_epochs_completed}")
    log(f"Best epoch identified: {best_epoch}")

    # 3. Evaluate on Validation Set
    log("\n[1] Evaluating Best Model on VALIDATION SET...")
    best_model = YOLO(str(best_weight_path))
    val_metrics = best_model.val(
        data=str(DATASET_YAML),
        split="val",
        imgsz=IMGSZ,
        batch=BATCH_SIZE,
        device="cpu",
        max_det=MAX_DET,
        conf=0.001,  # standard for mAP curve calculation
        iou=0.6,
        verbose=False,
    )

    val_precision = float(val_metrics.results_dict.get("metrics/precision(B)", 0.0))
    val_recall = float(val_metrics.results_dict.get("metrics/recall(B)", 0.0))
    val_map50 = float(val_metrics.results_dict.get("metrics/mAP50(B)", 0.0))
    val_map50_95 = float(val_metrics.results_dict.get("metrics/mAP50-95(B)", 0.0))

    log("Validation Metrics:")
    log(f"  Precision: {val_precision:.4f}")
    log(f"  Recall:    {val_recall:.4f}")
    log(f"  mAP50:     {val_map50:.4f}")
    log(f"  mAP50-95:  {val_map50_95:.4f}")

    # 4. Evaluate on Test Set
    log("\n[2] Evaluating Best Model on TEST SET...")
    test_metrics = best_model.val(
        data=str(DATASET_YAML),
        split="test",
        imgsz=IMGSZ,
        batch=BATCH_SIZE,
        device="cpu",
        max_det=MAX_DET,
        conf=0.001,
        iou=0.6,
        verbose=False,
    )

    test_precision = float(test_metrics.results_dict.get("metrics/precision(B)", 0.0))
    test_recall = float(test_metrics.results_dict.get("metrics/recall(B)", 0.0))
    test_map50 = float(test_metrics.results_dict.get("metrics/mAP50(B)", 0.0))
    test_map50_95 = float(test_metrics.results_dict.get("metrics/mAP50-95(B)", 0.0))

    log("Test Set Metrics:")
    log(f"  Precision: {test_precision:.4f}")
    log(f"  Recall:    {test_recall:.4f}")
    log(f"  mAP50:     {test_map50:.4f}")
    log(f"  mAP50-95:  {test_map50_95:.4f}")

    # 5. Counting Evaluation on Test Set
    log(f"\n[3] Running Colony COUNTING Evaluation on TEST SET (Confidence = {CONFIDENCE_THRESHOLD})...")
    test_images_dir = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "test"
    test_labels_dir = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "test"
    test_images = sorted(list(test_images_dir.glob("*.jpg")))

    abs_errors = []
    pct_errors = []
    detailed_counts = []
    bucket_counts = {
        "exact": 0,
        "within_1": 0,
        "within_5": 0,
        "within_10": 0,
        "over_10": 0,
    }

    for img_p in test_images:
        lbl_p = test_labels_dir / f"{img_p.stem}.txt"
        gt_count = 0
        if lbl_p.exists():
            with open(lbl_p, "r") as f:
                gt_count = len([l for l in f.readlines() if l.strip()])

        # Run inference
        pred_res = best_model.predict(
            source=str(img_p),
            conf=CONFIDENCE_THRESHOLD,
            imgsz=IMGSZ,
            device="cpu",
            max_det=MAX_DET,
            verbose=False,
        )[0]

        pred_count = len(pred_res.boxes)
        abs_err = abs(pred_count - gt_count)
        pct_err = (abs_err / max(1, gt_count)) * 100.0

        abs_errors.append(abs_err)
        pct_errors.append(pct_err)

        if abs_err == 0:
            bucket_counts["exact"] += 1
        if abs_err <= 1:
            bucket_counts["within_1"] += 1
        if abs_err <= 5:
            bucket_counts["within_5"] += 1
        if abs_err <= 10:
            bucket_counts["within_10"] += 1
        else:
            bucket_counts["over_10"] += 1

        detailed_counts.append({
            "image": img_p.name,
            "gt_count": gt_count,
            "pred_count": pred_count,
            "abs_error": abs_err,
            "pct_error": round(pct_err, 2),
        })

    n_test = len(abs_errors)
    sorted_abs = sorted(abs_errors)
    sorted_pct = sorted(pct_errors)

    mae = sum(abs_errors) / n_test if n_test > 0 else 0.0
    med_ae = sorted_abs[n_test // 2] if n_test % 2 != 0 else (sorted_abs[n_test // 2 - 1] + sorted_abs[n_test // 2]) / 2
    max_ae = max(abs_errors) if n_test > 0 else 0

    mean_pct = sum(pct_errors) / n_test if n_test > 0 else 0.0
    med_pct = sorted_pct[n_test // 2] if n_test % 2 != 0 else (sorted_pct[n_test // 2 - 1] + sorted_pct[n_test // 2]) / 2
    max_pct = max(pct_errors) if n_test > 0 else 0.0

    log("Counting Evaluation Results:")
    log(f"  Mean Absolute Error (MAE):     {mae:.2f} colonies")
    log(f"  Median Absolute Error:         {med_ae:.2f} colonies")
    log(f"  Max Absolute Error:            {max_ae} colonies")
    log(f"  Mean Percentage Error:         {mean_pct:.2f}%")
    log(f"  Median Percentage Error:       {med_pct:.2f}%")
    log(f"  Max Percentage Error:          {max_pct:.2f}%")
    log(f"  Exact Count:                   {bucket_counts['exact']}/{n_test} ({bucket_counts['exact']/n_test:.1%})")
    log(f"  Within ±1:                     {bucket_counts['within_1']}/{n_test} ({bucket_counts['within_1']/n_test:.1%})")
    log(f"  Within ±5:                     {bucket_counts['within_5']}/{n_test} ({bucket_counts['within_5']/n_test:.1%})")
    log(f"  Within ±10:                    {bucket_counts['within_10']}/{n_test} ({bucket_counts['within_10']/n_test:.1%})")
    log(f"  Over ±10 error:                {bucket_counts['over_10']}/{n_test} ({bucket_counts['over_10']/n_test:.1%})")

    # 6. Difficult Case Analysis & Visual Samples
    log(f"\n[4] Generating Visual Verification Samples in {SAMPLES_DIR}...")
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

    # Pick representative samples: low density, high density, median density, max error
    detailed_counts.sort(key=lambda x: x["abs_error"])
    sample_targets = [
        ("best_low_density", detailed_counts[0]["image"]),
        ("median_case", detailed_counts[len(detailed_counts) // 2]["image"]),
        ("difficult_case", detailed_counts[-1]["image"]),
        ("difficult_case_2", detailed_counts[-2]["image"]),
    ]

    saved_samples_meta = []
    for tag, img_name in sample_targets:
        img_p = test_images_dir / img_name
        lbl_p = test_labels_dir / f"{img_p.stem}.txt"

        pred_res = best_model.predict(
            source=str(img_p),
            conf=CONFIDENCE_THRESHOLD,
            imgsz=IMGSZ,
            device="cpu",
            max_det=MAX_DET,
            verbose=False,
        )[0]

        # Draw ground truth (green) and predictions (cyan/magenta)
        with Image.open(img_p) as im:
            rendered = im.copy().convert("RGB")
            draw = ImageDraw.Draw(rendered)
            w, h = rendered.size
            stroke_w = max(2, round(w / 400))

            # Ground truth in green
            if lbl_p.exists():
                with open(lbl_p, "r") as f:
                    gt_lines = f.readlines()
                for line in gt_lines:
                    parts = line.strip().split()
                    if len(parts) == 5:
                        xc, yc, bw, bh = map(float, parts[1:])
                        x1 = (xc - bw / 2) * w
                        y1 = (yc - bh / 2) * h
                        x2 = (xc + bw / 2) * w
                        y2 = (yc + bh / 2) * h
                        draw.rectangle([x1, y1, x2, y2], outline=(34, 197, 94), width=stroke_w)

            # Predictions in cyan
            for box in pred_res.boxes:
                coords = box.xyxy[0].tolist()
                draw.rectangle(coords, outline=(6, 182, 212), width=stroke_w)

            # Resize to max 1200px preview
            preview_max = 1200
            if w > preview_max:
                ratio = preview_max / w
                new_w = preview_max
                new_h = round(h * ratio)
                rendered = rendered.resize((new_w, new_h), Image.Resampling.LANCZOS)

            out_fn = f"eval_{tag}_{img_p.stem}_gt{len(gt_lines)}_pred{len(pred_res.boxes)}.jpg"
            rendered.save(SAMPLES_DIR / out_fn, format="JPEG", quality=88)
            saved_samples_meta.append({
                "tag": tag,
                "image": img_name,
                "file": out_fn,
                "gt_count": len(gt_lines),
                "pred_count": len(pred_res.boxes),
                "abs_error": abs(len(pred_res.boxes) - len(gt_lines)),
            })

    # 7. Write Full Report JSON
    report_data = {
        "timestamp": datetime.now().isoformat(),
        "model": {
            "name": "yolo11n.pt",
            "architecture": "YOLO11n",
            "weights_path": str(best_weight_path),
            "size_mb": best_model_size_mb,
            "classes": {0: "colony"},
            "nc": 1,
        },
        "environment": {
            "python": python_ver,
            "torch": torch_ver,
            "ultralytics": "8.4.152",
            "cuda_available": cuda_avail,
            "device": device_name,
            "cuda_version": cuda_ver,
        },
        "training_config": {
            "epochs_requested": EPOCHS,
            "epochs_completed": total_epochs_completed,
            "best_epoch": best_epoch,
            "patience": PATIENCE,
            "imgsz": IMGSZ,
            "batch_size": BATCH_SIZE,
            "seed": SEED,
            "workers": WORKERS,
            "max_det": MAX_DET,
            "duration_seconds": total_duration_sec,
            "duration_hours": round(total_duration_sec / 3600, 3),
        },
        "validation_metrics": {
            "precision": round(val_precision, 4),
            "recall": round(val_recall, 4),
            "mAP50": round(val_map50, 4),
            "mAP50_95": round(val_map50_95, 4),
        },
        "test_metrics": {
            "precision": round(test_precision, 4),
            "recall": round(test_recall, 4),
            "mAP50": round(test_map50, 4),
            "mAP50_95": round(test_map50_95, 4),
        },
        "counting_evaluation": {
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "test_images_count": n_test,
            "mae": round(mae, 2),
            "median_ae": round(med_ae, 2),
            "max_ae": max_ae,
            "mean_pct_error": round(mean_pct, 2),
            "median_pct_error": round(med_pct, 2),
            "max_pct_error": round(max_pct, 2),
            "buckets": bucket_counts,
        },
        "visual_samples": saved_samples_meta,
        "scientific_interpretation": {
            "status": "BASELINE_MODEL",
            "notes": (
                "This is the first experimental baseline model trained on a dual-core CPU with imgsz=640. "
                "Downsampling high-resolution (approx 3000x3000px) Petri dish photos to 640px creates an inherent "
                "limitation for tiny or touching colonies. Touching colonies in high-density cultures frequently merge "
                "into single bounding boxes, underestimating total CFU. External validation on unseen lab equipment is required."
            ),
        },
    }

    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    log(f"\n[5] Training report saved to: {REPORT_JSON}")
    log("=" * 70)
    log("PHASE 5C BASELINE TRAINING COMPLETE")
    log("=" * 70)


if __name__ == "__main__":
    train_baseline()
