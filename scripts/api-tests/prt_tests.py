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
    if response.status_code != 200:
        print(json.dumps({
            "test": "get_token",
            "method": "POST",
            "path": "/auth/login",
            "status": response.status_code,
            "request": payload,
            "response": response.text
        }))
        sys.exit(1)
    return response.json()["data"]["token"]

def log_result(test, method, path, status, req=None, resp=None):
    result = {
        "test": test,
        "method": method,
        "path": path,
        "status": status
    }
    if req:
        result["request"] = req
    if resp:
        result["response"] = resp
    print(json.dumps(result))

def test_get_active_presentation_types():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path with valid data
    response = requests.get(f"{BASE_URL}/presentation-types/active", headers=headers)
    log_result("test_get_active_presentation_types_happy_path",
               "GET", "/presentation-types/active", response.status_code)

    if response.status_code != 200:
        print(response.text)
        return False

    # Without token (should require auth)
    response = requests.get(f"{BASE_URL}/presentation-types/active")
    log_result("test_get_active_presentation_types_no_auth",
               "GET", "/presentation-types/active", response.status_code)

    if response.status_code not in [401, 403]:
        print(response.text)
        return False

    return True

def main():
    passed = []
    failed = []

    # Run tests
    if test_get_active_presentation_types():
        passed.append("test_get_active_presentation_types")
    else:
        failed.append("test_get_active_presentation_types")

    # Print summary
    print("\n=== TEST SUMMARY ===")
    for test in passed:
        print(f"PASSED: {test}")
    for test in failed:
        print(f"FAILED: {test}")

    return len(failed)

if __name__ == "__main__":
    sys.exit(main())