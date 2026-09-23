# Phase 5I — Full-Dataset Pseudo-Labeling & YOLO11n-Seg Training Report

## 1. Executive Summary & Objective
Phase 5I scaled the Phase 5H MobileSAM pseudo-labeling pipeline to the complete 258-image training set, applied atomic checkpointing and biological safeguards, and conducted a controlled YOLO11n-seg training experiment with full 55-image validation against the locked production YOLO11n baseline.

## 2. Production Baseline vs Phase 5I Segmentation (55 Plates)

| Metric | Production YOLO11n (Detector) | Phase 5I YOLO11n-seg (Instance Seg) | Difference |
|---|---|---|---|
| **Count MAE** | **9.0** | **15.27** | +6.27 |
| **Median Absolute Error** | 3.0 | 7.0 | +4.00 |
| **Mean % Error** | 5.78% | 11.08% | +5.30% |
| **Median % Error** | 3.85% | 6.12% | +2.27% |
| **Exact Match** | 10/55 (18.2%) | 8/55 (14.5%) | -2 |
| **Within ±5 Colonies** | 34/55 (61.8%) | 25/55 (45.5%) | -9 |
| **Within ±10 Colonies** | 42/55 (76.4%) | 33/55 (60.0%) | -9 |
| **Max Absolute Error** | 72 | 109 | +37 |

## 3. Density Tier Stratification

| Density Tier | Plates | Prod Count MAE | Seg Count MAE | Prod Median AE | Seg Median AE |
|---|---|---|---|---|---|
| **Low** | 15 | 0.67 | 2.53 | 1.0 | 1.0 |
| **Medium** | 22 | 6.0 | 9.77 | 4.0 | 8.0 |
| **High** | 14 | 11.5 | 34.14 | 10.0 | 29.0 |
| **Ultra-High** | 4 | 48.0 | 27.25 | 41.0 | 12.0 |

## 4. Production Safety Invariant Verification
> [!IMPORTANT]
> Production model `services/colony-detector/models/best.pt` remains strictly locked and untouched.
- Expected SHA-256: `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d`
- Verified SHA-256: `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d` (VERIFIED MATCH)
- Production FastAPI endpoints and default confidence (0.30) remain 100% operational and unchanged.

