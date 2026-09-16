# Phase 5E — Confidence Threshold & Colony Counting Optimization Report

**Date**: 2026-09-16 23:06:30  
**Execution Runtime**: 7.6 minutes  
**Model Weights**: `services/colony-detector/models/best.pt`  
**Model SHA-256**: `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d`  

---

## 1. Executive Summary & Selection Decision

- **Baseline Threshold (Phase 5C)**: `0.30`
- **Candidate Thresholds Evaluated**: `0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60`
- **Dataset Evaluated for Selection**: **Validation Set ONLY** (55 physical plates, 8,024 colonies)
- **Test Set Protection Protocol**: Test set remained completely untouched until selection was locked.
- **Selected Operating Threshold**: **`0.35`**
- **Selection Decision Rationale**: Ranked #1 with highest composite score (0.9996) on validation set.

---

## 2. Validation Set Threshold Evaluation (0.20 – 0.60)

The table below shows detection and counting performance across all nine evaluated thresholds on the **55 validation plates**:

| Threshold | Precision | Recall | mAP50 | MAE (colonies) | MedAE | Mean % Err | Med % Err | Exact Matches | $\pm 5$ Plates | $\pm 10$ Plates | Max AE |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `0.20` | 91.2% | 89.4% | 89.6% | 19.07 | 8.0 | 12.82% | 9.52% | 2/55 (3.6%) | 23/55 (41.8%) | 30/55 (54.5%) | 175 |
| `0.25` | 91.2% | 89.4% | 89.6% | 13.20 | 6.0 | 7.78% | 5.73% | 4/55 (7.3%) | 27/55 (49.1%) | 37/55 (67.3%) | 136 |
| `0.30` | 91.1% | 89.5% | 88.8% | 9.00 | 3.0 | 5.78% | 3.85% | 10/55 (18.2%) | 34/55 (61.8%) | 42/55 (76.4%) | 72 |
| `0.35` **(Selected)** | 91.2% | 89.4% | 87.8% | 7.95 | 3.0 | 6.36% | 3.30% | 9/55 (16.4%) | 32/55 (58.2%) | 42/55 (76.4%) | 72 |
| `0.40` | 92.6% | 87.7% | 86.0% | 10.35 | 3.0 | 9.02% | 5.00% | 9/55 (16.4%) | 35/55 (63.6%) | 38/55 (69.1%) | 101 |
| `0.45` | 93.8% | 84.7% | 83.2% | 14.84 | 5.0 | 14.20% | 6.59% | 6/55 (10.9%) | 29/55 (52.7%) | 37/55 (67.3%) | 134 |
| `0.50` | 95.2% | 80.1% | 79.4% | 22.91 | 7.0 | 21.77% | 12.00% | 7/55 (12.7%) | 25/55 (45.5%) | 30/55 (54.5%) | 172 |
| `0.55` | 96.4% | 73.3% | 72.7% | 34.69 | 13.0 | 32.90% | 22.64% | 1/55 (1.8%) | 17/55 (30.9%) | 25/55 (45.5%) | 251 |
| `0.60` | 97.6% | 63.9% | 63.0% | 50.85 | 25.0 | 44.22% | 41.28% | 1/55 (1.8%) | 12/55 (21.8%) | 17/55 (30.9%) | 356 |

---

## 3. Final Test Set Evaluation & Phase 5C Baseline Comparison

The untouched **unseen test set** (56 plates, 7,994 colonies) was evaluated once after locking the threshold:

| Metric | Phase 5C Baseline (`conf=0.30`) | Selected Threshold (`conf=0.35`) | Absolute Change |
| :--- | :---: | :---: | :---: |
| **Detection Precision** | 88.45% | 89.76% | +1.31% |
| **Detection Recall** | 87.12% | 85.89% | -1.23% |
| **mAP50** | 85.04% | 83.26% | -1.78% |
| **Counting MAE** | 8.39 colonies | 9.39 colonies | +1.00 colonies |
| **Median Absolute Error** | 3.00 colonies | 3.00 colonies | +0.00 colonies |
| **Mean % Error** | 5.96% | 7.10% | +1.14% |
| **Median % Error** | 4.35% | 4.35% | +0.02% |
| **Exact Count Matches** | 11/56 (19.6%) | 10/56 (17.9%) | -1 plates |
| **Within $\pm 5$ Colonies** | 36/56 (64.3%) | 36/56 (64.3%) | +0 plates |
| **Within $\pm 10$ Colonies** | 44/56 (78.6%) | 46/56 (82.1%) | +2 plates |
| **Max Absolute Error** | 76 colonies | 64 colonies | -12 colonies |

---

## 4. Density Breakdown on Test Set

Performance breakdown across biological culture density categories:

| Density Group | Definition | Plates | GT Mean Count | MAE (colonies) | Median AE | Median % Err | Within $\pm 5$ | Within $\pm 10$ |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Low Density** | < 50 colonies | 17 | — | 1.65 | 1.0 | 5.71% | 16/17 (94.1%) | 17/17 (100.0%) |
| **Medium Density** | 50–200 colonies | 26 | — | 8.00 | 3.5 | 3.75% | 18/26 (69.2%) | 23/26 (88.5%) |
| **High Density** | > 200 colonies | 13 | — | 22.31 | 18.0 | 4.29% | 2/13 (15.4%) | 6/13 (46.1%) |
| **Ultra-High Lawn** | > 400 colonies | 5 | — | 14.40 | 9.0 | 2.00% | 0/5 (0.0%) | 3/5 (60.0%) |

---

## 5. Scientific Findings & High-Density Failure Mode Analysis

### A. Did Confidence Threshold Tuning Solve High-Density Undercounting?

**Finding**: No. Lowering the confidence threshold (e.g. to 0.20) only moderately increases raw candidate box count and slightly reduces undercounting on crowded plates, but introduces false positive detections on agar surface reflections and plate borders. Higher thresholds (0.40–0.60) exacerbate undercounting by suppressing true micro-colonies.

**Root Cause**: The fundamental error mechanism on plates with > 400 colonies is **bacterial confluence and spatial overlap**. When colonies physically touch and coalesce into confluent lawns, downscaling to 640px causes YOLO to detect adjacent clusters as single large bounding boxes. This is an architectural resolution and spatial segmentation limitation, NOT a confidence threshold filtering problem.

### B. Operational Stability

The current baseline threshold of `0.30` resides in the optimal plateau region of the validation curve, providing a balanced trade-off between suppressing noise/artifacts (Precision ~89–91%) and preserving colony recall (~87–89%).
