import requests
import json
import sys
import time

BASE_URL = "http://localhost:5001/api"

def get_token():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "username": "admin",
        "password": "141103"
    }
    response = requests.post(url, json=payload)
    log_result("get_token", "POST", "/auth/login", response.status_code, payload, response.json())
    return response.json()["data"]["token"]

def log_result(test, method, path, status, req, resp):
    result = {
        "test": test,
        "method": method,
        "path": path,
        "status": status,
        "request": req,
        "response": resp
    }
    print(json.dumps(result))

def upload_single_image(token):
    url = f"{BASE_URL}/upload"
    headers = {
        'Authorization': f'Bearer {token}'
    }

    # Happy path with valid data
    files = {'image': ('test.png', open('/home/joel/Projects/Emprendimiento-Lobo/backend/public/uploads/products/placeholder.png', 'rb'), 'image/png')}
    response = requests.post(url, headers=headers, files=files)
    log_result("upload_single_image", "POST", "/upload", response.status_code, {"image": "placeholder.png"}, response.json())

def upload_multiple_images(token):
    url = f"{BASE_URL}/upload/multiple"
    headers = {
        'Authorization': f'Bearer {token}'
    }

    # Happy path with valid data
    files = [
        ('images', ('test1.png', open('/home/joel/Projects/Emprendimiento-Lobo/backend/public/uploads/products/placeholder.png', 'rb'), 'image/png')),
        ('images', ('test2.png', open('/home/joel/Projects/Emprendimiento-Lobo/backend/public/uploads/products/placeholder.png', 'rb'), 'image/png'))
    ]
    response = requests.post(url, headers=headers, files=files)
    log_result("upload_multiple_images", "POST", "/upload/multiple", response.status_code, {"images": ["placeholder.png", "placeholder.png"]}, response.json())

def delete_image(token):
    url = f"{BASE_URL}/upload/image"
    headers = {
        'Authorization': f'Bearer {token}'
    }
    payload = {
        "url": "path/to/test.png"  # This should be the actual path of an uploaded image
    }

    response = requests.delete(url, headers=headers, json=payload)
    log_result("delete_image", "DELETE", "/upload/image", response.status_code, payload, response.json())

def main():
    token = get_token()

    upload_single_image(token)
    upload_multiple_images(token)
    delete_image(token)

if __name__ == "__main__":
    sys.exit(main())