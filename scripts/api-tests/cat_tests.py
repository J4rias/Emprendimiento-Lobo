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
        result["request"] = json.dumps(request_data)
    if response_data:
        result["response"] = json.dumps(response_data)

    print(json.dumps(result))

def test_list_categories():
    url = f"{BASE_URL}/categories"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_categories", "GET", "/categories", response.status_code)

def test_create_category(tag):
    url = f"{BASE_URL}/categories"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "code": f"TEST_CODE_{tag}_{int(time.time())}",
        "name": f"API_TEST_DELETE_{tag}_{int(time.time())}",
        "description": "Test category description",
        "color": "#FF0000"
    }

    response = requests.post(url, headers=headers, json=payload)
    log_result("test_create_category", "POST", "/categories", response.status_code, payload, response.json())
    return response.json()["data"] if response.status_code == 201 else None

def test_get_category(category_id):
    url = f"{BASE_URL}/categories/{category_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_category", "GET", f"/categories/{category_id}", response.status_code)

def test_update_category(category_id):
    url = f"{BASE_URL}/categories/{category_id}"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "name": f"API_TEST_UPDATE_{int(time.time())}",
        "description": "Updated test category description",
        "color": "#00FF00"
    }

    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_category", "PUT", f"/categories/{category_id}", response.status_code, payload, response.json())

def test_delete_category(category_id):
    url = f"{BASE_URL}/categories/{category_id}"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {"is_active": False}

    response = requests.put(url, headers=headers, json=payload)
    log_result("test_delete_category", "PUT", f"/categories/{category_id}", response.status_code, payload, response.json())

def test_no_auth():
    url = f"{BASE_URL}/categories"
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/categories", response.status_code)

def test_invalid_data():
    url = f"{BASE_URL}/categories"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {}  # Missing required fields

    response = requests.post(url, headers=headers, json=payload)
    log_result("test_invalid_data", "POST", "/categories", response.status_code, payload, response.json())

def test_not_found():
    url = f"{BASE_URL}/categories/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/categories/99999999", response.status_code)

def test_duplicate():
    url = f"{BASE_URL}/categories"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "code": "TEST_CODE_DUPLICATE",
        "name": "API_TEST_DUPLICATE",
        "description": "Test duplicate category description",
        "color": "#0000FF"
    }

    # Create the first instance
    response1 = requests.post(url, headers=headers, json=payload)
    if response1.status_code != 201:
        log_result("test_duplicate", "POST", "/categories", response1.status_code, payload, response1.json())
        return

    # Try to create the second instance with same data
    response2 = requests.post(url, headers=headers, json=payload)
    log_result("test_duplicate", "POST", "/categories", response2.status_code, payload, response2.json())

def main():
    tag = f"TEST_{int(time.time())}"
    created_category_id = None

    try:
        test_list_categories()

        # Create a category for testing
        created_category = test_create_category(tag)
        if created_category and "id" in created_category:
            created_category_id = created_category["id"]

            # Test GET, UPDATE with the created category
            test_get_category(created_category_id)
            test_update_category(created_category_id)

        # Test error cases
        test_no_auth()
        test_invalid_data()
        test_not_found()
        test_duplicate()

    finally:
        if created_category_id:
            test_delete_category(created_category_id)

if __name__ == "__main__":
    sys.exit(main())