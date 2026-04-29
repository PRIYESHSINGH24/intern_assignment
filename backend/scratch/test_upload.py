import os
import requests
import uuid

BACKEND_URL = "http://localhost:8000"
MOCK_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mock_data"))

def run_test_upload():
    # 1. Create a Case
    case_data = {
        "name": "Project Mock-Test (Image & OCR)",
        "description": "Auto-generated test case containing 20 mixed document types, images, and duplicates.",
        "priority": "high"
    }
    
    print(f"Creating case...")
    resp = requests.post(f"{BACKEND_URL}/api/cases/", json=case_data)
    if not resp.ok:
        print(f"Failed to create case: {resp.status_code} - {resp.text}")
        return
    
    case = resp.json()
    case_id = case["id"]
    print(f"✓ Case Created: {case_id}")

    # 2. Upload all documents
    files = [f for f in os.listdir(MOCK_DIR) if os.path.isfile(os.path.join(MOCK_DIR, f))]
    print(f"Uploading {len(files)} files...")
    
    upload_url = f"{BACKEND_URL}/api/cases/{case_id}/upload"
    
    upload_payload = []
    for f in files:
        f_path = os.path.join(MOCK_DIR, f)
        with open(f_path, "rb") as file_bytes:
            files_multipart = {"files": (f, file_bytes.read())}
            r = requests.post(upload_url, files=files_multipart)
            if r.status_code == 200:
                print(f"  ✓ Uploaded: {f}")
            else:
                print(f"  ✗ Failed: {f} - {r.text}")

    print("\n✅ Test data injection complete!")
    print(f"Navigate to: http://localhost:5173/cases/{case_id} to see the results.")

if __name__ == "__main__":
    run_test_upload()
