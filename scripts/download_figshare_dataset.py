"""Dataset Downloader for Solymosi et al. (Figshare DOI: 10.6084/m9.figshare.22022540)

Downloads:
- 369 Petri dish images (.jpg)
- YOLO annotations (annot_YOLO.zip)
- COCO annotations (annot_COCO.json)
- Tabular annotations (annot_tab.csv)
- Metadata spreadsheet (images.xls)
Verifies MD5 checksums and supports resumed downloads.
"""

import hashlib
import json
import os
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests

ARTICLE_ID = 22022540
API_URL = f"https://api.figshare.com/v2/articles/{ARTICLE_ID}"

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "ml-data" / "colony-dataset"
RAW_DIR = DATASET_DIR / "raw"
IMAGES_DIR = RAW_DIR / "images"
ANNOT_YOLO_DIR = RAW_DIR / "annot_YOLO"

RAW_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def calculate_md5(filepath: Path) -> str:
    """Calculates MD5 hash of a file."""
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def download_single_file(file_info: dict, target_path: Path, max_retries: int = 5) -> bool:
    """Downloads a single file from Figshare with MD5 verification and retries."""
    name = file_info["name"]
    url = file_info["download_url"]
    expected_md5 = file_info.get("computed_md5") or file_info.get("supplied_md5")
    expected_size = file_info.get("size")

    # If file already exists and MD5 matches, skip
    if target_path.exists() and target_path.stat().st_size == expected_size:
        if expected_md5:
            actual_md5 = calculate_md5(target_path)
            if actual_md5 == expected_md5:
                return True

    for attempt in range(1, max_retries + 1):
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path = target_path.with_suffix(target_path.suffix + ".part")

            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()

            with open(temp_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)

            # Check MD5
            if expected_md5:
                actual_md5 = calculate_md5(temp_path)
                if actual_md5 != expected_md5:
                    temp_path.unlink(missing_ok=True)
                    print(f"[RETRY {attempt}/{max_retries}] MD5 mismatch for {name}")
                    continue

            # Rename on success
            if target_path.exists():
                target_path.unlink()
            temp_path.rename(target_path)
            return True
        except Exception as e:
            time.sleep(attempt * 1.5)
            if attempt == max_retries:
                print(f"[ERROR] Failed to download {name} after {max_retries} attempts: {e}")
                return False

    return False


def main():
    print(f"Querying Figshare API for article {ARTICLE_ID}...")
    resp = requests.get(API_URL, timeout=20)
    resp.raise_for_status()
    article_data = resp.json()

    files = article_data.get("files", [])
    print(f"Found {len(files)} total files in Figshare article.")

    # Save complete API metadata
    metadata_path = RAW_DIR / "figshare_article_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(article_data, f, indent=2)

    # Separate metadata/annotation files and image files
    annotation_files = []
    image_files = []

    for f in files:
        fname = f["name"]
        if fname.endswith(".jpg"):
            image_files.append((f, IMAGES_DIR / fname))
        else:
            annotation_files.append((f, RAW_DIR / fname))

    print(f"Identified {len(image_files)} images and {len(annotation_files)} annotation/metadata files.")

    # 1. Download annotation and metadata files first
    print("\n--- Downloading Annotations and Metadata ---")
    for f_info, dest in annotation_files:
        print(f"Downloading {f_info['name']} ({f_info['size'] / (1024*1024):.2f} MB)...")
        ok = download_single_file(f_info, dest)
        if not ok:
            print(f"Warning: Failed to download {f_info['name']}")

    # Unzip annot_YOLO.zip if present
    yolo_zip_path = RAW_DIR / "annot_YOLO.zip"
    if yolo_zip_path.exists():
        print("Extracting annot_YOLO.zip...")
        ANNOT_YOLO_DIR.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(yolo_zip_path, "r") as zf:
            zf.extractall(ANNOT_YOLO_DIR)
        print(f"Extracted YOLO annotations to {ANNOT_YOLO_DIR}")

    # 2. Download images in parallel with ThreadPoolExecutor
    print(f"\n--- Downloading {len(image_files)} Specimen Images (~584 MB) ---")
    start_time = time.time()
    completed = 0
    failed = 0

    # Use 8 workers for fast concurrent download
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_name = {
            executor.submit(download_single_file, f_info, dest): f_info["name"]
            for f_info, dest in image_files
        }

        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                success = future.result()
                if success:
                    completed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Exception downloading {name}: {e}")
                failed += 1

            if completed % 25 == 0 or completed == len(image_files):
                pct = (completed / len(image_files)) * 100
                print(f"Progress: {completed}/{len(image_files)} images ({pct:.1f}%) downloaded.")

    elapsed = time.time() - start_time
    print(f"\nFinished in {elapsed:.1f}s. Successfully downloaded {completed}/{len(image_files)} images (Failed: {failed}).")


if __name__ == "__main__":
    main()
