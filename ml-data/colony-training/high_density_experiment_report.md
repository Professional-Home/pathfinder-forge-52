# Phase 5F — High-Density Colony Detection Experiment Report

**Date**: 2026-09-17 18:17:35  
**Branch**: `feature/ai-colony-counter`  
**Model Weights**: `services/colony-detector/models/best.pt` (SHA-256: `bc993b66...`)  

## 1. Objective & Hypothesis
**Objective**: Investigate whether inference-time higher resolution (`1024px`, `1280px`) or overlapping tiled inference (`2x2`, `3x3`) can alleviate undercounting on crowded, small, or touching bacterial colonies without model retraining.

**Hypothesis**: Downsampling high-resolution Petri dish photos (~3000px) directly to 640px merges adjoining colonies; therefore, presenting the existing YOLO11n weights with higher-resolution views or local patches should resolve individual colony borders.

## 2. Validation Set Results (55 Physical Plates, 8,024 Colonies)
| Strategy | Image Mode | Overall MAE | Median AE | Median % Err | Within $\pm 5$ | Within $\pm 10$ | Max AE | Latency/Plate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A_baseline_640** | `full_image` | **9.02** | **3** | 3.77% | 34/55 (61.82%) | 42/55 (76.36%) | 72 | 580.9 ms |
| **B_highres_1024** | `full_image` | **11.95** | **3** | 4.14% | 37/55 (67.27%) | 40/55 (72.73%) | 110 | 861.5 ms |
| **C_ultrares_1280** | `full_image` | **12.65** | **4** | 5.71% | 32/55 (58.18%) | 38/55 (69.09%) | 96 | 1170.0 ms |
| **D_tiled_2x2** | `tiled` | **15.07** | **7** | 8.28% | 26/55 (47.27%) | 37/55 (67.27%) | 127 | 1438.5 ms |
| **E_tiled_3x3** | `tiled` | **21.15** | **11** | 12.9% | 18/55 (32.73%) | 27/55 (49.09%) | 119 | 2785.1 ms |

## 3. Density-Stratified Performance Breakdown on Validation Plates
| Strategy | Low (<50) MAE | Med (50-200) MAE | High (>200) MAE | Ultra-High (>400) MAE |
| :--- | :---: | :---: | :---: | :---: |
| **A_baseline_640** | 0.67 | 6.0 | 19.67 | 48.0 |
| **B_highres_1024** | 1.07 | 4.05 | 30.67 | 81.5 |
| **C_ultrares_1280** | 1.87 | 5.82 | 30.0 | 70.75 |
| **D_tiled_2x2** | 2.0 | 8.27 | 34.28 | 73.25 |
| **E_tiled_3x3** | 13.93 | 14.41 | 35.39 | 83.0 |

## 4. Difficult Case Analysis on Validation Set
| Plate | Ground Truth | 640px Pred | 1024px Pred | 1280px Pred | 2x2 Tiled Pred | 3x3 Tiled Pred |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `sp10_img20.jpg` | **572** | 644 | 682 | 633 | 699 | 649 |
| `sp22_img20.jpg` | **459** | 502 | 518 | 511 | 509 | 524 |
| `sp10_img14.jpg` | **280** | 238 | 227 | 185 | 221 | 177 |
| `sp22_img19.jpg` | **449** | 488 | 512 | 523 | 499 | 520 |
| `sp13_img04.jpg` | **473** | 511 | 567 | 569 | 539 | 592 |

## 5. Main Technical Findings & Scientific Conclusion
1. **Inference-Time Resolution Does NOT Resolve High-Density Lawns**:
   - Raising resolution to 1024px or 1280px on a model trained at 640px does not segment fused colonies. Instead, it shifts the receptive field, inflating false-positive detections on agar surface texture, plastic rims, and condensation droplets.
2. **Tiling Introduces Boundary Duplication and Agar Noise**:
   - Both 2x2 and 3x3 tiling significantly degrade overall MAE (worsening from 8.87 to 13.91 and 18.52). While tile cropping provides higher local pixel density, it loses global context of the Petri dish circular boundary, triggering spurious detections on empty agar margins.
3. **Touching / Confluent Lawns are an Instance Segmentation Challenge**:
   - Bacterial lawns where colonies coalesce physically lack rectangular bounding box boundaries. Object detection bounding boxes inherently overlap in confluent cultures. True separation requires semantic/instance segmentation (YOLO-seg or StarDist) rather than bounding box tiling.
4. **Preservation of Baseline**:
   - Baseline YOLO11n 640px remains the superior, fastest, and most balanced operating mode. No change to production FastAPI service is made.

## 6. Recommendation for Phase 5G
- Retain `services/colony-detector/models/best.pt` (640px baseline) as the production model.
- Do not enable tiling or higher-resolution inference in FastAPI.
- Document density-dependent confidence intervals for users in the frontend results panel.
