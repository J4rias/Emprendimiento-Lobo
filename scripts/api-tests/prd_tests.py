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

def log_result(test, method, path, status, req=None, resp=None):
    result = {
        "test": test,
        "method": method,
        "path": path,
        "status": status,
        "request": req,
        "response": resp
    }
    print(json.dumps(result))

def test_list_products():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_list_products", "GET", "/products", response.status_code)

def test_create_product():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products"
    timestamp = int(time.time())
    payload = {
        "name": f"API_TEST_DELETE_{timestamp}",
        "description": "Test product",
        "category_id": 1,
        "brand_id": 1
    }

    # Happy path
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_create_product", "POST", "/products", response.status_code)

def test_get_product():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products/1"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_product", "GET", "/products/1", response.status_code)

def test_update_product():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products/1"
    payload = {
        "name": "Updated Test Product",
        "description": "Updated description"
    }

    # Happy path
    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_product", "PUT", "/products/1", response.status_code)

def test_delete_product():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products/1"

    # Happy path
    response = requests.delete(url, headers=headers)
    log_result("test_delete_product", "DELETE", "/products/1", response.status_code)

def test_no_auth():
    url = f"{BASE_URL}/products"

    # No auth
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/products", response.status_code)

def test_invalid_data():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products"
    payload = {
        "name": "",
        "description": "Test product",
        "category_id": 1,
        "brand_id": 1
    }

    # Invalid data
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_invalid_data", "POST", "/products", response.status_code)

def test_not_found():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products/99999999"

    # Not found
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/products/99999999", response.status_code)

def test_duplicate():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/products"
    payload = {
        "name": "Duplicate Test Product",
        "description": "Test product",
        "category_id": 1,
        "brand_id": 1
    }

    # Duplicate
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_duplicate", "POST", "/products", response.status_code)

def main():
    tests = [
        test_list_products,
        test_create_product,
        test_get_product,
        test_update_product,
        test_delete_product,
        test_no_auth,
        test_invalid_data,
        test_not_found,
        test_duplicate
    ]

    failures = 0

    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"Exception: {e}")
            failures += 1

    print(f"\nSummary: PASSED={len(tests) - failures}, FAILED={failures}")

    return failures

if __name__ == "__main__":
    sys.exit(main())