# Phase 5G — Density Alert & Segmentation Feasibility Report
**Project:** Micrylis Biotech — AI Petri Dish Colony Counter  
**Branch:** `feature/ai-colony-counter`  
**Dataset Evaluation Scope:** Validation Split (55 physical plates, 8,024 ground-truth colonies)

---

## 1. Objective
Phase 5G investigates two core engineering and scientific objectives:
1. **Density / Uncertainty Alert (Production Safety):** Implement a deterministic, transparent plate density and confluence warning mechanism in the FastAPI service and React frontend, notifying researchers when automated counting reliability is degraded in crowded cultures.
2. **Instance Segmentation Feasibility Study:** Systematically determine whether classical distance-transform watershed or YOLO instance segmentation (YOLO-seg) can separate touching/confluent colonies and resolve high-density counting limitations without degrading baseline performance.

---

## 2. Existing Baseline
The current production model is locked and untouched:
- **Weights:** `services/colony-detector/models/best.pt` (SHA-256: `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d`)
- **Architecture:** YOLO11n (single class: `0 = colony`)
- **Input Resolution:** 640px full image (`imgsz=640`)
- **Locked Confidence Threshold:** $0.30$
- **Phase 5F Validation Baseline:** Count MAE: 9.00 colonies, Median AE: 3.0, Mean % Error: 5.78%, Median % Error: 3.85%, Latency: 383.3 ms / plate.
- **Phase 5F Protected Test Set Baseline:** Count MAE: 8.12 colonies, Precision: 89.09%, Recall: 86.70%, mAP50: 88.66%.

---

## 3. Density Reliability Analysis
Empirical evaluation across Phases 5C, 5E, and 5F revealed that the model's counting accuracy is strongly correlated with culture density:
- **Low Density (<50 colonies):** MAE = **0.67**, Median AE = 1.0, Mean Error = 5.88%. Detector is exceptionally reliable.
- **Medium Density (50–200 colonies):** MAE = **6.00**, Median AE = 4.0, Mean Error = 5.88%. Well within acceptable screening tolerances.
- **High Density (201–400 colonies):** MAE = **19.61**, Median AE = 11.5, Mean Error = 5.60%. Colonies begin physically touching; bounding boxes cluster adjacent colonies.
- **Ultra-High Density (>400 colonies):** MAE = **48.00**, Median AE = 41.0, Mean Error = 9.67%, Max AE = 72. Severe confluence and bacterial lawn formation occur; discrete bounding boxes cannot physically isolate individual colony centers.

In standard microbiological practice (e.g., FDA BAM, USP <61>), agar plates with $>250$ or $>300$ CFU are classified as "Too Numerous To Count" (TNTC) due to crowding inhibition and colony coalescence. Standard protocol mandates serial dilutions ($10^{-3}, 10^{-4}, 10^{-5}$) to obtain countable plates in the 30–300 CFU range.

---

## 4. Density Alert Design
To provide transparent operational feedback without making clinical diagnostic claims, we designed project-specific operational density tiers:

| Tier | Predicted Count | Review Advisory | Warning Message |
|---|---|---|---|
| **Low** | $< 50$ | None | None (`Plate count is within low-density operating range (<50)`) |
| **Medium** | $50 - 200$ | Standard | None, unless spatial overlap ratio $> 40\%$ |
| **High** | $201 - 400$ | **Recommended** | *"High-density plate detected. Automated count may be less reliable in crowded colony regions. Manual verification is recommended."* |
| **Ultra-High** | $> 400$ | **Strongly Recommended** | *"Very high-density plate detected. Individual colonies may overlap or form confluent regions. Manual verification is strongly recommended."* |

### Deterministic Confluence & Overlap Signal
In addition to raw count, the service computes pairwise spatial overlap across all detected bounding boxes:
- Bounding box pairs with $\text{IoU} > 0.10$ are tagged as touching/overlapping.
- **Overlap Ratio:** $\text{overlap\_ratio} = \frac{N_{\text{overlapping}}}{N_{\text{total}}}$.
- **Confluence Risk:**
  - `high`: $\text{overlap\_ratio} \ge 0.40$ or ($\text{count} > 100$ and $\text{overlap\_ratio} \ge 0.25$)
  - `medium`: $\text{overlap\_ratio} \ge 0.15$ or ($\text{count} > 50$ and $\text{overlap\_ratio} \ge 0.10$)
  - `low`: otherwise.

---

## 5. API Changes (Backward-Compatible)
In `services/colony-detector/app/schemas.py`, the success payload was augmented with an optional `quality` object:

```json
{
  "success": true,
  "count": 268,
  "detections": [...],
  "image": { "width": 3001, "height": 2960 },
  "annotated_image_url": "http://localhost:8000/outputs/annotated_abc123.jpg",
  "processing_time_ms": 412,
  "quality": {
    "density_level": "high",
    "review_recommended": true,
    "warning_message": "High-density plate detected. Automated count may be less reliable in crowded colony regions. Manual verification is recommended.",
    "confluence_risk": "medium",
    "overlap_ratio": 0.31,
    "reason": "Predicted colony count (268) exceeds high-density cutoff (>200)."
  }
}
```
Existing frontend clients consuming only `count` and `detections` experience zero breaking changes.

---

## 6. Frontend Changes
- [`src/lib/colony-api.ts`](file:///f:/Project/pathfinder-forge-52/src/lib/colony-api.ts): Added `ColonyQualityAssessment` interface.
- [`src/components/tools/ColonyResultsPanel.tsx`](file:///f:/Project/pathfinder-forge-52/src/components/tools/ColonyResultsPanel.tsx):
  - Prominent alert banner rendered at the top of results when `review_recommended` is true.
  - Rose styling for `ultra_high` with confluence notice.
  - Amber styling for `high` with review advisory.
  - Summary card augmented with "Operational Density Tier" and "Crowding / Confluence Risk" badges with percent overlap.

---

## 7. Existing Annotation Format Audit
Inspection of the raw ADBC dataset (`ml-data/colony-dataset/raw/annot_COCO.json`, `annot_tab.tsv`) and YOLO annotations confirmed:
- `segmentation` field in COCO JSON: `None` across 100% of annotations.
- The dataset contains **only axis-aligned rectangular bounding boxes** (`[x, y, width, height]`).
- **No polygon boundaries, contours, or pixel masks exist in the dataset.**

---

## 8. Segmentation Feasibility Overview
Four approaches were benchmarked across the 55 validation plates (8,024 ground-truth colonies):
1. **Baseline YOLO (640px):** Deep neural object detector.
2. **Global Otsu Watershed:** Contrast normalization (CLAHE) $\rightarrow$ circular plate mask $\rightarrow$ Otsu thresholding $\rightarrow$ morphological opening $\rightarrow$ Euclidean distance transform $\rightarrow$ sure foreground markers $\rightarrow$ marker-controlled watershed.
3. **Top-Hat Filter Watershed:** Morphological Top-Hat / Black-Hat transform $\rightarrow$ circular plate mask $\rightarrow$ local background removal $\rightarrow$ adaptive distance transform $\rightarrow$ marker-controlled watershed.
4. **Hybrid YOLO + Local Watershed:** Constrains segmentation to YOLO candidate regions and analyzes distance-transform sub-peaks in oversized bounding boxes.

---

## 9 & 10. Validation Results (55 Plates, 8,024 Ground-Truth Colonies)

| Method | Count MAE | Median AE | Mean % Err | Median % Err | Exact | $\pm 5$ | Max AE | Latency |
|---|---|---|---|---|---|---|---|---|
| **1. Baseline YOLO (640px)** | **9.00** | **3.0** | **5.78%** | **3.85%** | **10** | **34** | **72** | **383.3 ms** |
| **2. Global Otsu Watershed** | 67.56 | 40.0 | 75.12% | 46.77% | 0 | 2 | 270 | 656.8 ms |
| **3. Top-Hat Filter Watershed** | 569.89 | 56.0 | 1132.02% | 39.37% | 0 | 8 | 4216 | 1838.2 ms |
| **4. Hybrid YOLO + Watershed** | 10.16 | 5.0 | 6.92% | 4.53% | 10 | 31 | 72 | 398.9 ms |

*(Lower is better for MAE, MedAE, % Err, Max AE; higher is better for Exact, $\pm 5$)*

---

## 11. Density-Wise Results (Validation Set)

| Density Tier | Plates | Baseline YOLO MAE | Otsu Watershed MAE | Top-Hat Watershed MAE | Hybrid YOLO+WS MAE |
|---|---|---|---|---|---|
| **Low (<50)** | 15 | **0.67** | 16.80 | 363.00 | **0.67** |
| **Medium (50–200)** | 22 | **6.00** | 46.73 | 991.00 | 8.36 |
| **High (>200)** | 18 | **19.61** | 135.33 | 227.61 | 20.28 |
| **Ultra-High (>400)** | 4 | **48.00** | 97.00 | 118.00 | 48.75 |

---

## 12. Difficult Cases

| Image Stem | Ground Truth | Baseline YOLO | Otsu Watershed | Top-Hat Watershed | Hybrid YOLO+WS | Failure Mode Analysis |
|---|---|---|---|---|---|---|
| `sp01_img01` | 4 | **5 (+1)** | 26 (+22) | 19 (+15) | 5 (+1) | Classical watershed falsely segments Petri rim reflections and meniscus glare. |
| `sp21_img13` | 61 | **61 (0)** | 54 (-7) | 3484 (+3423) | 61 (0) | Top-hat explodes on agar grain texture, treating noise specks as colonies. |
| `sp04_img03` | 50 | **58 (+8)** | 29 (-21) | 295 (+245) | 68 (+18) | Hybrid watershed oversplits irregular oblong colonies into duplicate markers. |
| `sp05_img11` | 146 | **162 (+16)** | 103 (-43) | 497 (+351) | 179 (+33) | Pigment gradient causes Otsu to lose faint colonies while top-hat over-segments. |
| `sp13_img04` | 473 | **511 (+38)** | 299 (-174) | 301 (-172) | 513 (+40) | Confluent center. Distance transform collapses into single flat plateaus. |
| `sp22_img20` | 459 | **502 (+43)** | 395 (-64) | 335 (-124) | 502 (+43) | Dense touching mats. Otsu undercounts heavily due to lack of concave boundaries. |

---

## 13. Visual Findings
Visual comparison collages were saved to `ml-data/colony-training/phase5g_eval_samples/`:
1. **Agar Texture Sensitivity:** Unsupervised distance transform treats surface micro-irregularities, condensation, and plastic mould lines as valid foreground objects, leading to astronomical over-segmentation on certain plates (e.g. `sp21_img13` with 3,484 false peaks).
2. **Species Pigmentation Variance:** ADBC contains bacterial species ranging from opaque white to translucent amber and red. Global thresholding cannot adapt across the dish without sacrificing sensitivity or specificity.
3. **Loss of Concavity in Confluence:** In dense bacterial lawns, individual colonies physically coalesce into continuous mats. There are no optical boundaries or concave indentations for the watershed algorithm to flood; distance-transform markers merge into broad amorphous fields.

---

## 14. YOLO-Seg Feasibility Assessment
Training a dedicated YOLO instance segmentation model (`yolo11n-seg`) is theoretically the most promising deep-learning alternative, but faces the following engineering realities:
1. **Annotation Deficiency:** Zero polygon masks exist in ADBC. Training YOLO-seg requires converting bounding boxes into polygon masks.
2. **Annotation Workload:** Annotating 25,000+ colonies across 160 plates would require ~200–300 hours of manual annotation.
3. **Feasible Engineering Path (Semi-Automated):**
   - Use a pre-trained foundation segmentation model (e.g., Segment Anything Model / SAM or MobileSAM) with YOLO bounding boxes as bounding-box prompts.
   - Run SAM inference on cropped YOLO boxes to generate candidate binary masks.
   - Convert binary masks to YOLO polygon text format (`class x1 y1 x2 y2 ...`).
   - Train `yolo11n-seg` on the pseudo-labeled dataset.
4. **Compute Feasibility:** Training YOLO11n-seg on CPU would require ~8–12 hours for 50–100 epochs, making GPU acceleration highly recommended.

---

## 15. Production Impact
- **Model Checkpoint:** `services/colony-detector/models/best.pt` remains 100% unchanged.
- **Detector Pipeline:** The production service continues to run the baseline YOLO11n model at 640px.
- **Safety:** Classical watershed is NOT deployed to production.
- **Service Contract:** `POST /api/v1/detect-colonies` remains backward-compatible with enriched `quality` metadata.

---

## 16. Limitations
1. **Physical Lawn Confluence:** When colonies physically coalesce into continuous lawns, individual colonies no longer have discrete boundaries. Neither bounding boxes nor instance masks can reconstruct individual progenitor cells without dilution.
2. **CPU Processing Limits:** CPU inference precludes running heavy multi-scale ensemble segmentation models in real-time.
3. **Single-Class Scope:** Current model does not differentiate contaminant moulds from bacterial colonies.

---

## 17. Recommendation for Phase 5H
- **Recommendation:** Proceed with **Phase 5H: Semi-Automated Polygon Annotation & YOLO-Seg Proof-of-Concept**.
- **Implementation Steps:**
  1. Build a SAM/MobileSAM pseudo-mask generator script that takes existing YOLO boxes on the validation set and extracts polygon masks.
  2. Perform visual inspection on 10 difficult plates to verify mask quality.
  3. If pseudo-masks accurately delineate touching boundaries, train a lightweight `yolo11n-seg` prototype on a subset of dense plates.
