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
    if response.status_code == 200:
        return response.json()["data"]["token"]
    else:
        raise Exception(f"Failed to get token: {response.text}")

def log_result(test_name, method, path, status_code, request_data=None, response_data=None):
    result = {
        "test": test_name,
        "method": method,
        "path": path,
        "status_code": status_code
    }
    if request_data:
        result["request"] = request_data
    if response_data:
        result["response"] = response_data

    print(json.dumps(result))

def test_get_all_brands(token):
    url = f"{BASE_URL}/brands"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_all_brands", "GET", "/brands", response.status_code)
    return response

def test_get_active_brands(token):
    url = f"{BASE_URL}/brands/active"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_active_brands", "GET", "/brands/active", response.status_code)

def test_create_brand(token):
    url = f"{BASE_URL}/brands"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": f"API_TEST_DELETE_{int(time.time())}",
        "description": "Test brand description",
        "logo_url": "http://example.com/logo.png",
        "website": "http://example.com",
        "notes": "Test notes"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_brand", "POST", "/brands", response.status_code, payload)
    if response.status_code == 201:
        return response.json()["data"]
    else:
        raise Exception(f"Failed to create brand: {response.text}")

def test_get_brand_by_id(token, brand_id):
    url = f"{BASE_URL}/brands/{brand_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_brand_by_id", "GET", f"/brands/{brand_id}", response.status_code)

def test_update_brand(token, brand_id):
    url = f"{BASE_URL}/brands/{brand_id}"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "description": "Updated test brand description",
        "logo_url": "http://example.com/new-logo.png"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_brand", "PUT", f"/brands/{brand_id}", response.status_code, payload)

def test_delete_brand(token, brand_id):
    url = f"{BASE_URL}/brands/{brand_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers)
    log_result("test_delete_brand", "DELETE", f"/brands/{brand_id}", response.status_code)

def test_get_all_without_auth():
    url = f"{BASE_URL}/brands"
    response = requests.get(url)
    log_result("test_get_all_without_auth", "GET", "/brands", response.status_code)

def test_create_duplicate_brand(token):
    url = f"{BASE_URL}/brands"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "API_TEST_DELETE_DUPLICATE",
        "description": "Test brand description",
        "logo_url": "http://example.com/logo.png",
        "website": "http://example.com",
        "notes": "Test notes"
    }
    # Create the first instance
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code != 201:
        raise Exception(f"Failed to create brand: {response.text}")

    # Try creating a duplicate
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_brand", "POST", "/brands", response.status_code, payload)

def test_get_nonexistent_brand(token):
    url = f"{BASE_URL}/brands/99999999"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_nonexistent_brand", "GET", "/brands/99999999", response.status_code)

def main():
    token = get_token()
    failures = 0

    # Test GET all brands
    try:
        response = test_get_all_brands(token)
        if response.status_code != 200:
            failures += 1
    except Exception as e:
        print(e)
        failures += 1

    # Test GET active brands
    try:
        test_get_active_brands(token)
    except Exception as e:
        print(e)
        failures += 1

    # Create a brand for testing
    try:
        created_brand = test_create_brand(token)
        brand_id = created_brand["id"]
    except Exception as e:
        print(e)
        failures += 1
        return failures

    # Test GET brand by ID
    try:
        test_get_brand_by_id(token, brand_id)
    except Exception as e:
        print(e)
        failures += 1

    # Test UPDATE brand
    try:
        test_update_brand(token, brand_id)
    except Exception as e:
        print(e)
        failures += 1

    # Test DELETE brand
    try:
        test_delete_brand(token, brand_id)
    except Exception as e:
        print(e)
        failures += 1

    # Test GET all brands without auth
    try:
        test_get_all_without_auth()
    except Exception as e:
        print(e)
        failures += 1

    # Test CREATE duplicate brand
    try:
        test_create_duplicate_brand(token)
    except Exception as e:
        print(e)
        failures += 1

    # Test GET nonexistent brand
    try:
        test_get_nonexistent_brand(token)
    except Exception as e:
        print(e)
        failures += 1

    return failures

if __name__ == "__main__":
    sys.exit(main())