# Colony Detection Model Directory

This directory is intended to store the trained YOLO model weights for automated Petri-dish colony detection.

## Expected Weights File

- **Filename**: `best.pt`
- **Path**: `services/colony-detector/models/best.pt`
- **Class specification**: Single-class object detector:
  - `class_id`: `0`
  - `class_name`: `colony`

## Model Placement Instructions

1. Train a YOLOv8 or YOLOv11 model on an annotated Petri-dish dataset (e.g., AGAR dataset, Roboflow colony detection dataset).
2. Export or download the resulting PyTorch weights file: `best.pt`.
3. Place `best.pt` directly into this directory:
   ```bash
   cp /path/to/trained/best.pt services/colony-detector/models/best.pt
   ```
4. Ensure `COLONY_MODEL_PATH=models/best.pt` is set in `services/colony-detector/.env`.
5. Restart the FastAPI service. The `/health` endpoint will confirm:
   ```json
   {
     "status": "ok",
     "model_loaded": true,
     "model_path": "models/best.pt"
   }
   ```

## Current Status

> **Notice**: As of Phase 4, no trained weights (`best.pt`) are included in the repository. The microservice will return a structured `MODEL_NOT_CONFIGURED` response until valid weights are provided.
