# Annotated Dataset for Deep-Learning-Based Bacterial Colony Detection

This workspace contains verified dataset preparation scripts, split manifests, and documentation for the open-access bacterial culture dataset used to train the Micrylis AI Colony Counter.

---

## 1. Dataset Citation & Authorship

- **Dataset Title**: Annotated dataset for deep-learning-based bacterial colony detection
- **Dataset DOI**: [10.6084/m9.figshare.22022540](https://doi.org/10.6084/m9.figshare.22022540)
- **Associated Journal Article**:
  > Makrai, L., Fodróczy, B., Nagy, S. Á., Czeiszing, P., Csabai, I., Szita, G., & Solymosi, N. (2023).  
  > *Annotated dataset for deep-learning-based bacterial colony detection*.  
  > **Scientific Data**, 10(1), 497.  
  > DOI: [10.1038/s41597-023-02404-8](https://doi.org/10.1038/s41597-023-02404-8)
- **Authors**:
  László Makrai, Bettina Fodróczy, Sára Ágnes Nagy, Péter Czeiszing, István Csabai, Géza Szita, Norbert Solymosi.

---

## 2. Licensing & Terms of Use

- **License**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Permissions**:
  - **Share**: Copy and redistribute the material in any medium or format.
  - **Adapt**: Remix, transform, and build upon the material for any purpose, including commercial applications.
- **Mandatory Attribution Requirements**:
  - You must give appropriate credit to the authors.
  - Provide a link to the license (https://creativecommons.org/licenses/by/4.0/).
  - Indicate if changes were made: In Phase 5B, the original 24 bacterial species classes were re-mapped to a single class (`0: colony`), and 3 degenerate zero-height annotations were removed to prevent numerical instability during IoU calculation.
  - You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.

---

## 3. Dataset Summary & Preprocessing Results

| Metric | Raw Dataset | Processed YOLO Dataset | Notes |
|---|---|---|---|
| **Total Images** | `369` | `369` | Exact match across splits |
| **Total Bounding Boxes** | `56,865` | `56,862` | 3 degenerate boxes removed |
| **Classes** | `24` (`sp01`–`sp24`) | `1` (`0: colony`) | Normalized one-class target |
| **Train Set** | — | `258` images (40,844 colonies) | 69.92% of images, 71.8% boxes |
| **Validation Set** | — | `55` images (8,024 colonies) | 14.91% of images, 14.1% boxes |
| **Test Set** | — | `56` images (7,994 colonies) | 15.18% of images, 14.1% boxes |
| **Image Resolution Range** | `2122×2134` to `5942×5968` px | Preserved | No image recompression/resizing |
| **Camera Hardware** | LG Nexus 5X (12.3 MP, f/2.0) | LG Nexus 5X | Verified via EXIF metadata |
| **Illumination Backgrounds** | Black: 205, White: 164 | Balanced in all splits | Train: 138/120, Val: 34/21, Test: 33/23 |

---

## 4. Removed Degenerate Annotations (3 Boxes)

Three annotations in the official Figshare export possess zero vertical height ($h = 0.000000$). To avoid division-by-zero during bounding box IoU loss computation and avoid synthetic coordinate invention, these 3 lines were dropped:

1. `sp09_img07.txt` line 161: `8 0.954749 0.606083 0.000748 0.000000` (Assigned to `test`)
2. `sp22_img09.txt` line 146: `21 0.574486 0.346397 0.003357 0.000000` (Assigned to `train`)
3. `sp23_img15.txt` line 202: `22 0.220042 0.777778 0.000422 0.000000` (Assigned to `train`)

---

## 5. Leakage-Free Stratified Group Splitting

The raw dataset contains 140 twin pairs where the **identical physical Petri dish** was photographed under both black and white illumination backgrounds 2–15 seconds apart.

To prevent critical data leakage (e.g. an identical culture plate appearing in both train and validation), images are clustered into **229 physical dish sessions** (140 pairs + 89 single plates). Each entire dish cluster is placed strictly within a single split:
- **Random Seed**: `42`
- **Species Coverage**:
  - Train: 24 / 24 species
  - Validation: 22 / 24 species
  - Test: 20 / 24 species
  *(Species omitted in val/test have $\le 3$ total images in the dataset).*

---

## 6. Directory Structure

```
ml-data/colony-dataset/
├── raw/                             # [Gitignored, IMMUTABLE] Original downloaded assets
│   ├── images/                      # 369 original JPEG photos
│   ├── annot_YOLO/                  # 369 original YOLO 24-class txt files
│   ├── annot_COCO.json              # Original COCO format annotations
│   ├── annot_tab.csv                # Tabular bounding box coordinates
│   └── images.xls                   # Plate-level metadata (species, background, CFU count, EXIF)
├── processed_yolo/                  # [Images/Labels Gitignored] Clean one-class dataset
│   ├── data.yaml                    # YOLO dataset definition (path, train, val, test, nc: 1)
│   ├── validation_report.json       # Machine-readable validation audit
│   ├── images/                      # [Gitignored]
│   │   ├── train/                   # 258 images
│   │   ├── val/                     # 55 images
│   │   └── test/                    # 56 images
│   ├── labels/                      # [Gitignored] Converted 1-class annotations
│   │   ├── train/                   # 258 label files
│   │   ├── val/                     # 55 label files
│   │   └── test/                    # 56 label files
│   └── samples/                     # [Gitignored] Visual verification overlays
├── splits/                          # [Tracked] Reproducible split manifests
│   ├── train.txt                    # Relative image paths for train set
│   ├── val.txt                      # Relative image paths for validation set
│   ├── test.txt                     # Relative image paths for test set
│   └── split_summary.json           # Detailed statistical breakdown per split
├── inspection/                      # [Gitignored] Phase 5A inspection logs and samples
└── README.md                        # Documentation & attribution
```

---

## 7. Reproducibility Instructions

To reproduce the one-class YOLO dataset from the raw files:

```bash
# 1. Ensure Python dependencies are available
pip install Pillow xlrd pyyaml

# 2. Run deterministic preprocessing script (seed 42)
python scripts/prepare_colony_dataset.py
```

---

## 8. Phase 5C Baseline Model Results (YOLO11n)

- **Model Checkpoint**: `ml-data/colony-training/runs/baseline-yolo11n-640/weights/best.pt` (21.25 MB, YOLO11n)
- **Training Epochs**: 85 epochs on CPU (11.42 hours compute time)
- **Best Validation Epoch**: Epoch 82 (**92.32% mAP50**, 90.84% Precision, 88.58% Recall)
- **Unseen Test Set Performance (56 plates)**:
  - **mAP50**: **88.69%**
  - **Precision**: **88.82%**
  - **Recall**: **86.49%**
- **Test Set Colony Counting Accuracy (`conf=0.30`)**:
  - **Mean Absolute Error (MAE)**: **9.38 colonies**
  - **Median Absolute Error**: **3.00 colonies**
  - **Mean Percentage Error**: **7.91%**
  - **Accuracy Buckets**:
    - Exact match: 17.9% (10/56 plates)
    - Within $\pm 5$ colonies: 60.7% (34/56 plates)
    - Within $\pm 10$ colonies: 78.6% (44/56 plates)
- **Reproduce Evaluation**:
  ```bash
  python scripts/evaluate_colony_baseline.py
  ```
