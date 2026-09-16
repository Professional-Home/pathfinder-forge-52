# Micrylis Colony Detector Microservice

Independent Python/FastAPI microservice providing automated Petri-dish colony detection and counting powered by Ultralytics YOLO object detection.

---

## 1. System Requirements

- **Python**: `3.11+` (tested with Python 3.11 and 3.12)
- **Architecture**: Independent service decoupled from the React/TanStack frontend application
- **Compute**: CPU-ready (GPU acceleration optional for high-throughput batch inference)

---

## 2. Virtual Environment Setup & Installation

From the repository root or the microservice folder:

```bash
# 1. Navigate to the colony detector directory
cd services/colony-detector

# 2. Create a dedicated Python virtual environment
python -m venv .venv

# 3. Activate the virtual environment
# On Linux / macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.venv\Scripts\activate.bat

# 4. Install dependencies
pip install -r requirements.txt
```

---

## 3. Environment Variables

Create a local `.env` file in `services/colony-detector/` (refer to `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Server bind host |
| `PORT` | `8000` | Server HTTP port |
| `DEBUG` | `false` | Enable debug auto-reload |
| `FRONTEND_ORIGIN` | `http://localhost:8080,http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `COLONY_MODEL_PATH` | `models/best.pt` | Path to trained YOLO PyTorch weights |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Base URL used for constructing annotated image artifact links |

---

## 4. Running the Service Locally

```bash
# Start Uvicorn development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation is available at:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Redoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 5. Model Artifact & Placement (`best.pt`)

The service uses a single-class YOLO11n object detection model (`class_id = 0`, `class_name = "colony"`).

### Baseline Checkpoint Details:
- **Architecture**: YOLO11n (Ultralytics)
- **Source Experiment**: `baseline-yolo11n-640` (100 epochs, best epoch 82)
- **Model Checkpoint**: `services/colony-detector/models/best.pt`
- **Model Size**: ~5.23 MB (5,478,938 bytes)
- **SHA-256 Checksum**: `bc993b664da2bde5123b8a5c34726e4a35357434cb0c49cb523185f8c929064d`
- **Metadata Spec**: `services/colony-detector/models/model-info.json`

### Copying / Installing the Trained Model Artifact:
```bash
# Copy from Phase 5C training run (local development)
cp ml-data/colony-training/runs/baseline-yolo11n-640/weights/best.pt services/colony-detector/models/best.pt
```

*(Note: Model weights `*.pt` are strictly git-ignored and should not be committed to source control).*

---

## 6. API Endpoints

### 1. Health & Readiness Check

```http
GET /health
```

#### Response Example (Model Loaded):
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_path": "models/best.pt"
}
```

---

### 2. Colony Detection & Quantification

```http
POST /api/v1/detect-colonies
Content-Type: multipart/form-data
```

#### Request Parameters:
- `image` *(required, binary file)*: The uploaded Petri-dish specimen image (Max: 5 MB; formats: JPEG, PNG, WEBP).
- `confidence_threshold` *(optional, float)*: Confidence cutoff between `0.20` and `0.90` (default: `0.30`).

#### Success Response (HTTP 200):
```json
{
  "success": true,
  "count": 14,
  "detections": [
    {
      "x1": 120.5,
      "y1": 85.0,
      "x2": 168.2,
      "y2": 132.4,
      "confidence": 0.9421,
      "class_id": 0,
      "class_name": "colony"
    }
  ],
  "image": {
    "width": 1024,
    "height": 768
  },
  "annotated_image_url": "http://localhost:8000/outputs/annotated_a83f9c2d1e0b.jpg",
  "processing_time_ms": 315
}
```

#### Error Response (HTTP 400 / 413 / 503):
```json
{
  "success": false,
  "error": {
    "code": "MODEL_NOT_CONFIGURED",
    "message": "The trained colony detection model (best.pt) is not configured or not found. Please install the trained model weights into the models directory to enable inference."
  }
}
```

**Standardized Error Codes**:
- `INVALID_REQUEST`: Missing required `image` multipart field.
- `INVALID_IMAGE`: Uploaded file is corrupt, empty, or unsupported format.
- `IMAGE_TOO_LARGE`: Uploaded image exceeds 5 MB limit.
- `INVALID_CONFIDENCE_THRESHOLD`: Threshold is outside allowed bounds [0.20, 0.90].
- `MODEL_NOT_CONFIGURED`: Trained weights (`best.pt`) are missing from the models directory.
- `INFERENCE_ERROR`: Unhandled exception during YOLO execution.
- `INTERNAL_ERROR`: Internal server failure.

---

## 7. Connecting from Frontend

The React/TanStack frontend connects to this microservice via the environment variable `VITE_COLONY_ML_API_URL` (defaulting to `http://localhost:8000`).

Ensure your FastAPI `.env` permits the frontend origin:
```ini
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:8080
```

---

## 8. Docker Deployment

```bash
# Build Docker image
docker build -t micrylis-colony-detector services/colony-detector

# Run container with mounted models and outputs
docker run -p 8000:8000 \
  -v $(pwd)/services/colony-detector/models:/app/models \
  -v $(pwd)/services/colony-detector/outputs:/app/outputs \
  micrylis-colony-detector
```

---

## 9. Baseline Performance & Known Limitations

> [!NOTE]
> **Baseline Model Status**:  
> This model is an **experimental baseline** trained on a verified 369-plate dataset (56,862 annotations).  
> - **Validation mAP50**: `92.32%`
> - **Unseen Test mAP50**: `88.66%`
> - **Test Precision**: `89.09%` | **Test Recall**: `86.70%`
> - **Test Counting MAE**: `8.39 colonies` (Median absolute error: 3.0 colonies; 78.6% of plates within $\pm 10$ colonies).

### Technical & Biological Limitations:
1. **Confluent Lawns & Overlapping Colonies**: Plates with extreme bacterial confluence or dense clustering (>300 colonies) tend to merge adjoining colonies into single bounding boxes, leading to undercounting.
2. **Pinpoint Micro-colonies**: Extremely small micro-colonies (<5 pixels in original resolution) can be attenuated during YOLO 640px letterbox downsampling.
3. **CPU Inference Considerations**: When running on dual-core CPU hardware, initial cold-start inference incurs PyTorch graph initialization (~5s), while steady-state CPU inference runs in ~300–400ms per full plate.
4. **Research / Educational Use Only**: This baseline tool has not undergone regulated clinical diagnostic certification and requires human microbiologist oversight.
