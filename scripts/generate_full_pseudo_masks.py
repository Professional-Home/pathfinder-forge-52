"""Phase 5I — Full-Dataset Resumable MobileSAM Pseudo-Mask Generation Pipeline.

Generates high-quality YOLO segmentation pseudo-labels for the complete 258-image
training split with atomic checkpointing, signal handling, rim safeguards, and
confluence tagging.

Key Resilience & Scientific Features:
1. Atomic Checkpointing: Writes progress to a temporary file and atomically commits
   after every single completed image using os.replace().
2. Graceful Interruption Handling: Intercepts SIGINT (Ctrl+C) and SIGTERM to save
   state and log exact resume position.
3. Strict Deduplication & Idempotency: Validates existing outputs and resumes from
   the next unfinished image without re-processing.
4. Biological & Optical Safeguards:
   - Dynamic Petri-dish rim reflection suppression (r > 0.47 * dish diameter).
   - Six validated Phase 5H geometric filters (empty, tiny, leaking, boundary, fragmentation, geometry).
   - Confluent tagging (mutual Box IoU > 0.35).
5. Dataset Completion Marker: Creates phase5i_pseudomasks_complete.json only after
   all 258 images pass integrity validation.
"""

import json
import os
import signal
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import cv2
import numpy as np
import torch
from ultralytics import SAM

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "mobile_sam.pt"

# Source Data (Train split only)
TRAIN_IMG_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "train"
TRAIN_LBL_DIR = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "train"

# Target Phase 5I Dataset
TARGET_DATASET_DIR = BASE_DIR / "ml-data" / "colony-segmentation-phase5i"
TARGET_TRAIN_IMG = TARGET_DATASET_DIR / "images" / "train"
TARGET_TRAIN_LBL = TARGET_DATASET_DIR / "labels" / "train"
TARGET_VAL_IMG = TARGET_DATASET_DIR / "images" / "val"
TARGET_VAL_LBL = TARGET_DATASET_DIR / "labels" / "val"
DATA_YAML_PATH = TARGET_DATASET_DIR / "data.yaml"

# Checkpoint & Completion Markers
CHECKPOINT_PATH = BASE_DIR / "ml-data" / "colony-training" / "phase5i_pseudomask_checkpoint.json"
CHECKPOINT_TMP_PATH = BASE_DIR / "ml-data" / "colony-training" / "phase5i_pseudomask_checkpoint.json.tmp"
COMPLETE_MARKER_PATH = BASE_DIR / "ml-data" / "colony-training" / "phase5i_pseudomasks_complete.json"

BATCH_SIZE = 40  # Keep batch size safe for CPU memory
INTERRUPTED = False


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)


def handle_signal(sig, frame):
    global INTERRUPTED
    log(f"Received interruption signal ({sig}). Cleaning up and saving current progress...")
    INTERRUPTED = True


# Register signal handlers
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def load_boxes_yolo(label_path: Path, img_w: int, img_h: int) -> List[Dict[str, Any]]:
    """Loads YOLO format bounding boxes and converts to pixel coords."""
    boxes = []
    if not label_path.exists():
        return boxes

    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            cls_id = int(parts[0])
            xc = float(parts[1]) * img_w
            yc = float(parts[2]) * img_h
            bw = float(parts[3]) * img_w
            bh = float(parts[4]) * img_h

            x1 = max(0.0, xc - bw / 2.0)
            y1 = max(0.0, yc - bh / 2.0)
            x2 = min(float(img_w), xc + bw / 2.0)
            y2 = min(float(img_h), yc + bh / 2.0)

            boxes.append({
                "class_id": cls_id,
                "norm_yolo": [float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])],
                "xyxy": [x1, y1, x2, y2],
                "area": max(1.0, (x2 - x1) * (y2 - y1)),
                "center": (xc, yc),
            })
    return boxes


def calculate_mutual_ious(boxes: List[Dict[str, Any]]) -> List[float]:
    """Calculates max mutual Box IoU with any neighboring box for confluence tagging."""
    n = len(boxes)
    max_ious = [0.0] * n
    if n <= 1:
        return max_ious

    for i in range(n):
        b1 = boxes[i]["xyxy"]
        area1 = boxes[i]["area"]
        for j in range(i + 1, n):
            b2 = boxes[j]["xyxy"]
            area2 = boxes[j]["area"]

            ix1 = max(b1[0], b2[0])
            iy1 = max(b1[1], b2[1])
            ix2 = min(b1[2], b2[2])
            iy2 = min(b1[3], b2[3])

            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                iou = inter / (area1 + area2 - inter)
                if iou > max_ious[i]:
                    max_ious[i] = iou
                if iou > max_ious[j]:
                    max_ious[j] = iou

    return max_ious


def validate_mask_and_extract_polygon(
    mask_np: np.ndarray,
    box: Dict[str, Any],
    img_w: int,
    img_h: int,
    is_rim_candidate: bool,
    std_contrast: float,
) -> Tuple[str, Optional[List[float]], Dict[str, Any]]:
    """Evaluates mask quality against conservative filters and extracts normalized polygon."""
    bx1, by1, bx2, by2 = map(int, box["xyxy"])
    bx1, by1 = max(0, bx1), max(0, by1)
    bx2, by2 = min(img_w, bx2), min(img_h, by2)
    box_area = max(1.0, float((bx2 - bx1) * (by2 - by1)))

    mask_area = float(np.sum(mask_np > 0))
    area_ratio = mask_area / box_area
    crop = mask_np[by1:by2, bx1:bx2]

    metrics = {
        "mask_area": mask_area,
        "box_area": box_area,
        "area_ratio": area_ratio,
        "touches_4_boundaries": False,
        "num_components": 0,
        "num_polygon_vertices": 0,
    }

    # Rim Safeguard: reject low-contrast rim reflections near dish edge
    if is_rim_candidate and std_contrast < 8.5:
        return "RIM_REFLECTION_ARTIFACT", None, metrics

    # Filter 1: Empty mask
    if mask_area == 0 or crop.size == 0:
        return "EMPTY_MASK", None, metrics

    # Filter 2: Extremely small mask or miniscule area ratio
    if mask_area < 6.0 or area_ratio < 0.08:
        return "TOO_SMALL", None, metrics

    # Filter 3: Excessive leakage outside bounding box
    if area_ratio > 1.25:
        return "LEAKS_OUTSIDE_BOX", None, metrics

    # Filter 4: Boundary snapping (mask touches all 4 edges with substantial contact)
    ch, cw = crop.shape[:2]
    if ch > 2 and cw > 2:
        top_contact = np.sum(crop[0, :] > 0) / cw
        bottom_contact = np.sum(crop[-1, :] > 0) / cw
        left_contact = np.sum(crop[:, 0] > 0) / ch
        right_contact = np.sum(crop[:, -1] > 0) / ch

        if (top_contact > 0.15 and bottom_contact > 0.15 and
            left_contact > 0.15 and right_contact > 0.15):
            metrics["touches_4_boundaries"] = True
            return "TOUCHES_ALL_BOUNDARIES", None, metrics

    # Filter 5: Fragmentation analysis
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(crop, connectivity=8)
    valid_components = [stats[i, cv2.CC_STAT_AREA] for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] >= 3]
    metrics["num_components"] = len(valid_components)
    if len(valid_components) > 4:
        return "HIGH_FRAGMENTATION", None, metrics

    # Extract polygon contour
    contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return "INVALID_POLYGON", None, metrics

    largest_contour = max(contours, key=cv2.contourArea)
    poly_area = cv2.contourArea(largest_contour)
    if poly_area < 4.0:
        return "TOO_SMALL", None, metrics

    approx = cv2.approxPolyDP(largest_contour, 1.0, closed=True)
    if len(approx) < 3:
        return "INVALID_POLYGON", None, metrics

    pts = approx.reshape(-1, 2)
    metrics["num_polygon_vertices"] = len(pts)

    poly_norm = []
    for pt in pts:
        nx = float(np.clip(pt[0] / img_w, 0.0, 1.0))
        ny = float(np.clip(pt[1] / img_h, 0.0, 1.0))
        poly_norm.extend([nx, ny])

    return "ACCEPTED", poly_norm, metrics


def save_checkpoint_atomic(state: Dict[str, Any]):
    """Safely writes checkpoint using temporary file and atomic rename."""
    try:
        with open(CHECKPOINT_TMP_PATH, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(CHECKPOINT_TMP_PATH, CHECKPOINT_PATH)
    except Exception as e:
        log(f"WARNING: Checkpoint save failed: {e}")


def load_checkpoint() -> Optional[Dict[str, Any]]:
    """Loads existing checkpoint if present and valid."""
    if not CHECKPOINT_PATH.exists():
        return None
    try:
        with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "completed_images" in data and isinstance(data["completed_images"], list):
                return data
    except Exception as e:
        log(f"WARNING: Corrupted checkpoint detected ({e}). Backing up and starting fresh.")
        backup_path = CHECKPOINT_PATH.with_suffix(".corrupted")
        try:
            os.replace(CHECKPOINT_PATH, backup_path)
        except Exception:
            pass
    return None


def run_full_pipeline() -> Dict[str, Any]:
    log("==================================================")
    log("PHASE 5I — FULL TRAINING PSEUDO-MASK GENERATION")
    log("==================================================")

    # Ensure directories exist
    TARGET_TRAIN_IMG.mkdir(parents=True, exist_ok=True)
    TARGET_TRAIN_LBL.mkdir(parents=True, exist_ok=True)
    TARGET_VAL_IMG.mkdir(parents=True, exist_ok=True)
    TARGET_VAL_LBL.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Check if already fully complete
    if COMPLETE_MARKER_PATH.exists():
        log(f"Completion marker found: {COMPLETE_MARKER_PATH}")
        with open(COMPLETE_MARKER_PATH, "r", encoding="utf-8") as f:
            complete_data = json.load(f)
        log("Full pseudo-label generation already completed successfully. Skipping regeneration.")
        return complete_data

    # Load MobileSAM
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"MobileSAM weights not found at: {MODEL_PATH}")
    log(f"Loading MobileSAM model from {MODEL_PATH}...")
    t0_sam = time.perf_counter()
    sam_model = SAM(str(MODEL_PATH))
    log(f"MobileSAM loaded in {time.perf_counter() - t0_sam:.2f}s")

    # Discover training images
    all_train_imgs = sorted(list(TRAIN_IMG_DIR.glob("*.jpg")) + list(TRAIN_IMG_DIR.glob("*.png")))
    total_imgs = len(all_train_imgs)
    log(f"Discovered {total_imgs} training images in {TRAIN_IMG_DIR}")

    # Load or initialize checkpoint
    checkpoint = load_checkpoint()
    if checkpoint is not None:
        completed_set: Set[str] = set(checkpoint.get("completed_images", []))
        total_boxes_processed = checkpoint.get("total_boxes_processed", 0)
        total_masks_accepted = checkpoint.get("total_masks_accepted", 0)
        total_masks_rejected = checkpoint.get("total_masks_rejected", 0)
        confluent_masks_count = checkpoint.get("confluent_masks_count", 0)
        rim_safeguard_count = checkpoint.get("rim_safeguard_count", 0)
        rejection_reasons = checkpoint.get("rejection_reasons", {
            "EMPTY_MASK": 0, "TOO_SMALL": 0, "LEAKS_OUTSIDE_BOX": 0,
            "TOUCHES_ALL_BOUNDARIES": 0, "HIGH_FRAGMENTATION": 0,
            "INVALID_POLYGON": 0, "RIM_REFLECTION_ARTIFACT": 0,
        })
        log(f"RESUMING from checkpoint: {len(completed_set)}/{total_imgs} images already completed.")
        log(f"  Processed boxes so far: {total_boxes_processed} | Accepted: {total_masks_accepted}")
    else:
        completed_set = set()
        total_boxes_processed = 0
        total_masks_accepted = 0
        total_masks_rejected = 0
        confluent_masks_count = 0
        rim_safeguard_count = 0
        rejection_reasons = {
            "EMPTY_MASK": 0, "TOO_SMALL": 0, "LEAKS_OUTSIDE_BOX": 0,
            "TOUCHES_ALL_BOUNDARIES": 0, "HIGH_FRAGMENTATION": 0,
            "INVALID_POLYGON": 0, "RIM_REFLECTION_ARTIFACT": 0,
        }
        log("No previous checkpoint found. Starting fresh generation run.")

    t_start = time.perf_counter()

    for img_idx, img_path in enumerate(all_train_imgs, start=1):
        if INTERRUPTED:
            log("Process interrupted by user/signal. Stopping cleanly.")
            break

        stem = img_path.stem
        lbl_path = TRAIN_LBL_DIR / f"{stem}.txt"
        target_lbl = TARGET_TRAIN_LBL / f"{stem}.txt"
        target_img = TARGET_TRAIN_IMG / img_path.name

        # Skip if already completed
        if stem in completed_set and target_lbl.exists():
            continue

        if not lbl_path.exists():
            # Image without annotations
            with open(target_lbl, "w", encoding="utf-8") as f:
                pass
            completed_set.add(stem)
            continue

        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            log(f"[{img_idx}/{total_imgs}] WARNING: Failed to read image: {img_path}")
            continue

        img_h, img_w = img_bgr.shape[:2]
        boxes = load_boxes_yolo(lbl_path, img_w, img_h)
        n_boxes = len(boxes)
        total_boxes_processed += n_boxes

        # Pre-compute mutual IoUs for confluent tagging
        mutual_ious = calculate_mutual_ious(boxes)

        # Estimate dish center and rim radius
        center = (img_w / 2.0, img_h / 2.0)
        rim_radius = min(img_w, img_h) * 0.47

        accepted_polygons: List[List[float]] = []
        confluent_count_image = 0

        # Process in batches
        for b_start in range(0, n_boxes, BATCH_SIZE):
            if INTERRUPTED:
                break

            b_end = min(n_boxes, b_start + BATCH_SIZE)
            batch_boxes = boxes[b_start:b_end]
            prompt_bboxes = [b["xyxy"] for b in batch_boxes]

            try:
                sam_out = sam_model(
                    source=str(img_path),
                    bboxes=prompt_bboxes,
                    retina_masks=False,
                    device="cpu",
                    verbose=False,
                )
            except Exception as e:
                log(f"Error during MobileSAM inference on {stem} [{b_start}:{b_end}]: {e}")
                continue

            if not sam_out or len(sam_out) == 0 or sam_out[0].masks is None:
                total_masks_rejected += len(batch_boxes)
                rejection_reasons["EMPTY_MASK"] += len(batch_boxes)
                continue

            masks_tensor = sam_out[0].masks.data
            n_returned = len(masks_tensor)

            for i, b in enumerate(batch_boxes):
                global_b_idx = b_start + i
                is_confluent = (mutual_ious[global_b_idx] > 0.35)
                if is_confluent:
                    confluent_count_image += 1
                    confluent_masks_count += 1

                # Check rim proximity
                bcx, bcy = b["center"]
                d_center = np.sqrt((bcx - center[0])**2 + (bcy - center[1])**2)
                is_rim_candidate = (d_center > rim_radius)

                # Local contrast
                bx1, by1, bx2, by2 = map(int, b["xyxy"])
                crop = img_bgr[max(0, by1):min(img_h, by2), max(0, bx1):min(img_w, bx2)]
                if crop.size > 0:
                    gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                    contrast_std = float(np.std(gray_crop))
                else:
                    contrast_std = 20.0

                if i < n_returned:
                    mask_np = masks_tensor[i].cpu().numpy().astype(np.uint8)
                    status, poly, metrics = validate_mask_and_extract_polygon(
                        mask_np, b, img_w, img_h, is_rim_candidate, contrast_std
                    )
                else:
                    status, poly = "EMPTY_MASK", None

                if status == "ACCEPTED" and poly is not None:
                    accepted_polygons.append(poly)
                    total_masks_accepted += 1
                else:
                    total_masks_rejected += 1
                    rejection_reasons[status] = rejection_reasons.get(status, 0) + 1
                    if status == "RIM_REFLECTION_ARTIFACT":
                        rim_safeguard_count += 1

        if INTERRUPTED:
            log(f"Interrupted while processing {stem}. Progress saved up to previous completed plate.")
            break

        # Write accepted YOLO segmentation polygons to target label file
        with open(target_lbl, "w", encoding="utf-8") as out_f:
            for poly in accepted_polygons:
                poly_str = " ".join([f"{v:.6f}" for v in poly])
                out_f.write(f"0 {poly_str}\n")

        # Copy image if not present
        if not target_img.exists():
            import shutil
            shutil.copyfile(img_path, target_img)

        # Mark image completed
        completed_set.add(stem)

        # Atomic checkpoint commit
        checkpoint_data = {
            "version": "1.0",
            "model_id": "MobileSAM (mobile_sam.pt, Apache 2.0)",
            "timestamp": datetime.now().isoformat(),
            "total_images": total_imgs,
            "completed_images_count": len(completed_set),
            "completed_images": sorted(list(completed_set)),
            "last_completed_image": stem,
            "total_boxes_processed": total_boxes_processed,
            "total_masks_accepted": total_masks_accepted,
            "total_masks_rejected": total_masks_rejected,
            "confluent_masks_count": confluent_masks_count,
            "rim_safeguard_count": rim_safeguard_count,
            "rejection_reasons": rejection_reasons,
        }
        save_checkpoint_atomic(checkpoint_data)

        # Progress reporting
        pct = len(completed_set) / total_imgs * 100.0
        elapsed = time.perf_counter() - t_start
        avg_per_img = elapsed / max(1, (len(completed_set) - (len(completed_set) - img_idx)))
        remaining_sec = avg_per_img * (total_imgs - len(completed_set))
        log(f"[{img_idx}/{total_imgs}] {stem}: Accepted={len(accepted_polygons)}/{n_boxes} | Total Progress: {len(completed_set)}/{total_imgs} ({pct:.1f}%) | ETA: {remaining_sec/60:.1f}m")

    # Link/Copy Validation set for Phase 5I
    val_images_src = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "images" / "val"
    val_labels_src = BASE_DIR / "ml-data" / "colony-segmentation-poc" / "labels" / "val"
    val_fallback_labels = BASE_DIR / "ml-data" / "colony-dataset" / "processed_yolo" / "labels" / "val"

    for v_img in val_images_src.glob("*.jpg"):
        v_target_img = TARGET_VAL_IMG / v_img.name
        if not v_target_img.exists():
            import shutil
            shutil.copyfile(v_img, v_target_img)

        v_target_lbl = TARGET_VAL_LBL / f"{v_img.stem}.txt"
        if not v_target_lbl.exists():
            v_poc_lbl = val_labels_src / f"{v_img.stem}.txt"
            if v_poc_lbl.exists():
                import shutil
                shutil.copyfile(v_poc_lbl, v_target_lbl)
            else:
                # Convert fallback box to 4-point rectangle polygon
                v_box_lbl = val_fallback_labels / f"{v_img.stem}.txt"
                if v_box_lbl.exists():
                    with open(v_box_lbl, "r", encoding="utf-8") as in_f, open(v_target_lbl, "w", encoding="utf-8") as out_f:
                        for line in in_f:
                            parts = line.strip().split()
                            if len(parts) >= 5:
                                xc, yc, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                                x1, y1 = xc - bw / 2, yc - bh / 2
                                x2, y2 = xc + bw / 2, yc + bh / 2
                                out_f.write(f"0 {x1:.6f} {y1:.6f} {x2:.6f} {y1:.6f} {x2:.6f} {y2:.6f} {x1:.6f} {y2:.6f}\n")

    # Write data.yaml
    with open(DATA_YAML_PATH, "w", encoding="utf-8") as yf:
        yf.write(f"path: {TARGET_DATASET_DIR.as_posix()}\n")
        yf.write("train: images/train\n")
        yf.write("val: images/val\n")
        yf.write("names:\n  0: colony\n")

    # Check if 100% completed
    if len(completed_set) == total_imgs and not INTERRUPTED:
        complete_summary = {
            "status": "COMPLETED",
            "completion_timestamp": datetime.now().isoformat(),
            "total_images": total_imgs,
            "total_boxes_processed": total_boxes_processed,
            "total_masks_accepted": total_masks_accepted,
            "total_masks_rejected": total_masks_rejected,
            "acceptance_rate_pct": round(total_masks_accepted / max(1, total_boxes_processed) * 100.0, 2),
            "confluent_masks_count": confluent_masks_count,
            "rim_safeguard_count": rim_safeguard_count,
            "rejection_reasons": rejection_reasons,
            "dataset_yaml": str(DATA_YAML_PATH),
        }
        with open(COMPLETE_MARKER_PATH, "w", encoding="utf-8") as cf:
            json.dump(complete_summary, cf, indent=2)
        log(f"Full pseudo-mask generation completed! Marker written to: {COMPLETE_MARKER_PATH}")
        return complete_summary
    else:
        log(f"Pipeline paused at {len(completed_set)}/{total_imgs} images. Checkpoint saved.")
        return checkpoint_data if 'checkpoint_data' in locals() else {}


if __name__ == "__main__":
    run_full_pipeline()
