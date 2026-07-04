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

def test_get_active_packaging_types():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path with valid data
    response = requests.get(f"{BASE_URL}/packaging-type/active", headers=headers)
    log_result("test_get_active_packaging_types_happy_path",
               "GET", "/packaging-type/active", response.status_code,
               None, response.json())

    # Without token (should require auth)
    response = requests.get(f"{BASE_URL}/packaging-type/active")
    log_result("test_get_active_packaging_types_no_auth",
               "GET", "/packaging-type/active", response.status_code)

def main():
    test_results = []

    # Run tests
    try:
        test_get_active_packaging_types()
    except Exception as e:
        print(f"Error during testing: {e}")

    return len(test_results)  # Return the count of failed tests

if __name__ == "__main__":
    sys.exit(main())