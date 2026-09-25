# Phase 5M — Independent Calibration & Generalization Validation: Data Audit Report

**Author:** AI Petri-Dish Colony Counter Research Suite  
**Date:** 2026-09-25 19:17:26  
**Branch:** `feature/ai-colony-counter`  
**Status:** Completed (Audit Complete — Outcome B Determined)

---

## 1. Executive Summary

Phase 5M was initiated to independently validate the **frozen dynamic density cascade routing candidate** (`predicted_count > 400`) identified in Phase 5K and analyzed in Phase 5L, with specific emphasis on validating performance in the previously unobserved **300–500 colony range** (particularly the 325–487 empirical void).

### Core Finding: **OUTCOME B — No Suitable Independent Data Exists**
Following an exhaustive cryptographic and provenance audit across the entire repository:
1. **Zero Out-of-Distribution Data Available:** Every single colony image present in the workspace originates from the single benchmark dataset (DOI `10.6084/m9.figshare.22022540`, totaling exactly 369 images).
2. **Strict Quarantines Maintained:**
   * The **258 training plates** are disqualified due to direct training leakage.
   * The **55 validation plates** are disqualified because the candidate threshold was evaluated on them in Phase 5K/5L; recycling them would violate basic scientific validity.
   * The **56 protected test plates** (7,994 colonies) remain **100% untouched and quarantined**, strictly adhering to the prohibition against consuming test sets for intermediate calibration.
3. **No Synthetic Fabrication:** In accordance with project instructions, synthetic images, pseudo-labels, and invented counts were strictly rejected.
4. **Conclusion:** Independent calibration and generalization **cannot be legitimately established** within the current repository assets. Phase 5M terminates at the audit milestone without running spurious evaluations.

---

## 2. Production Model Invariants

The production colony detection model was cryptographically verified prior to execution:
* **Model Path:** `F:\Project\pathfinder-forge-52\services\colony-detector\models\best.pt`
* **Expected SHA-256:** `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d`
* **Actual SHA-256:** `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d` (**VERIFIED EXACT MATCH**)
* **Production Parameters:** Confidence `0.30`, Resolution `640px`, Class `colony`.
* **FastAPI Service:** Zero production code changes; all existing test contracts passed.
* **Protected Test Set:** Untouched and strictly quarantined.

---

## 3. Data Sources Audited (Task 2 & 3)

An exhaustive scan of all filesystem assets was conducted. The results are summarized below:

| Dataset / Partition | Path | Total Images | Total Colonies | Provenance / Role | Qualification Status | Disqualification Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Raw Dataset Pool** | `ml-data/colony-dataset/raw/images` | 369 | 56,862 | Figshare 22022540 complete raw collection | Disqualified | Parent set containing all train, val, and test splits. Zero unassigned images. |
| **Training Split** | `ml-data/colony-dataset/processed_yolo/images/train` | 258 | 40,844 | Fitted YOLO11n detector & Phase 5I seg model | **NOT INDEPENDENT** | Direct training leakage. Model weights learned these plates. |
| **Validation Split** | `ml-data/colony-dataset/processed_yolo/images/val` | 55 | 8,024 | Evaluated in Phase 5H, 5I, 5J, 5K, 5L | **NOT INDEPENDENT** | Threshold `count > 400` was evaluated on this exact set. Cannot re-validate independently. |
| **Protected Test Split** | `ml-data/colony-dataset/processed_yolo/images/test` | 56 | 7,994 | Blind production holdout split | **PROTECTED QUARANTINE** | Strict protocol violation to evaluate prior to approved production gating. |
| **Phase 5I Seg Mirrors** | `ml-data/colony-segmentation-phase5i/images/*` | 313 | 48,868 | Direct filesystem mirror of train (258) + val (55) | **NOT INDEPENDENT** | Byte-for-byte duplicates of train and val splits. |
| **Auxiliary Eval Samples** | `ml-data/colony-training/*_eval_samples` | 78 | Variable | Subsets extracted during Phase 5E, 5F, 5G, 5H | **NOT INDEPENDENT** | Direct subsets of the 55 validation plates. |
| **Training Run Artifacts** | `ml-data/colony-training/runs/*` | 42 | N/A | Loss plots, PR curves, batch debug plots | **INVALID DATA** | Diagnostic plots and training logs, not specimen images. |
| **Microservice Outputs** | `services/colony-detector/outputs` | 18 | N/A | Temporary output debug artifacts from test runs | **INVALID DATA** | Generated bounding box test outputs. |
| **Web Marketing Assets** | `public/`, `.output/public/` | 26 | N/A | Landing page hero and card graphics | **INVALID DATA** | Non-specimen marketing media. |

---

## 4. Rigorous Split Integrity Analysis

Cross-referencing split manifest files ([`train.txt`](file:///f:/Project/pathfinder-forge-52/ml-data/colony-dataset/splits/train.txt), [`val.txt`](file:///f:/Project/pathfinder-forge-52/ml-data/colony-dataset/splits/val.txt), [`test.txt`](file:///f:/Project/pathfinder-forge-52/ml-data/colony-dataset/splits/test.txt)):
* Train Stems: 258
* Val Stems: 55
* Test Stems: 56
* Total Stems: 258 + 55 + 56 = 369
* Train and Val overlap: 0 (disjoint sets)
* Train and Test overlap: 0 (disjoint sets)
* Val and Test overlap: 0 (disjoint sets)
* Unassigned Raw Images: 0

Every single specimen image in the repository is fully accounted for by the original three-way split. No uncataloged plates, backup batches, or secondary datasets exist on local disk.

---

## 5. Frozen Routing Specification (Task 6)

Had independent data existed, the following configuration was formally frozen for Phase 5M evaluation without retuning:
* **Routing Decision Rule:** `predicted_count > 400`
* **Base Detector:** Production YOLO11n (`services/colony-detector/models/best.pt`)
* **Detection Parameters:** Confidence = `0.30`, Resolution = `640px`
* **Conditional Segmenter:** Phase 5I YOLO11n-seg (`ml-data/colony-training/phase5i-seg-training/weights/best.pt`)
* **Tuning Policy:** **STRICTLY LOCKED**. No threshold sweeps or metric-driven adaptations permitted.

---

## 6. Detailed Justification for Outcome B (Task 4)

1. **Why Train Data Cannot Be Used:** The production YOLO11n detector achieved high training recall on these plates; evaluating routing on training data would introduce massive confirmation bias.
2. **Why Validation Data Cannot Be Used:** Re-evaluating the 55 plates would merely reproduce the exact numbers from Phase 5K and Phase 5L without testing out-of-sample generalization.
3. **Why Protected Test Data Cannot Be Used:** The protected test set must remain uncorrupted for formal production acceptance. Consuming it for iterative calibration would permanently eliminate the project's unbiased test gate.
4. **Why Synthetic Data Was Rejected:** Generative models or image modifications do not accurately reflect the physical optics, colony confluence dynamics, or agar edge reflections of real microbiology plates.

---

## 7. Missing Data Requirements for Future Calibration

To legitimately validate dynamic density cascade routing before production deployment, an independent dataset must be acquired satisfying the following specifications:
1. **Source Diversity:** Specimen dishes collected from independent laboratory sites using diverse agar media (e.g. Nutrient Agar, MacConkey, Blood Agar) and camera imaging configurations.
2. **Target Density Distribution:** Focused acquisition of dishes in the **300 to 500 colony range**, specifically populating the 325–487 colony interval where zero validation dishes currently exist.
3. **Annotation Rigor:** Ground-truth colony annotations verified by professional microbiologists with dual-reader consensus on dense clusters.
4. **Statistical Power:** A minimum sample size of N >= 30 plates in the high/ultra-high boundary region.

---

## 8. Deployment Readiness Assessment & Recommendation

| Question | Assessment Category | Evidence & Rationale |
| :--- | :--- | :--- |
| **Independent Generalization Established?** | **Not supported by current evidence** | Zero independent out-of-distribution plates exist in the repository. |
| **Is `count > 400` Ready for Production Freeze?** | **Requires additional validation** | While stable on the 55 validation plates, behavior in the 325–487 range remains empirically unobserved. |
| **Protected Test Set Status?** | **Quarantined & Untouched** | 56 test plates preserved strictly intact for final production verification. |
| **Recommended Next Step?** | **Actionable Laboratory Protocol** | Acquire an external calibration batch of 30–50 high-density plates before making any architectural routing changes to the production service. |

**Final Recommendation:** Keep the production detector locked at YOLO11n detection (`services/colony-detector/models/best.pt`, conf=0.30, imgsz=640). Maintain the service without active routing until external calibration data can be acquired and evaluated.
