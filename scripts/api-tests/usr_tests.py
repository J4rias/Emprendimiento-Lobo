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
        data = response.json()
        # Handle both old and new response formats
        token = data.get("token") or data.get("data", {}).get("token")
        return token
    else:
        print(f"Failed to get token: {response.status_code} - {response.text}")
        sys.exit(1)

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

def test_get_all_users():
    url = f"{BASE_URL}/users"
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_all_users", "GET", "/users", response.status_code)

def test_create_user():
    url = f"{BASE_URL}/users"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    timestamp = str(int(time.time()))
    payload = {
        "username": f"API_TEST_DELETE_USER_{timestamp}",
        "email": f"user_{timestamp}@test.com",
        "password": "141103",
        "first_name": "Test",
        "last_name": "User",
        "phone": "1234567890",
        "role_id": 1,
        "is_active": True
    }

    # Happy path
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_create_user", "POST", "/users", response.status_code)

def test_get_user():
    url = f"{BASE_URL}/users/1"  # Assuming ID 1 exists for testing
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_user", "GET", "/users/1", response.status_code)

def test_update_user():
    url = f"{BASE_URL}/users/1"  # Assuming ID 1 exists for testing
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "email": "updated_user@test.com",
        "first_name": "Updated",
        "last_name": "User",
        "phone": "0987654321",
        "role_id": 1,
        "is_active": True
    }

    # Happy path
    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_user", "PUT", "/users/1", response.status_code)

def test_delete_user():
    url = f"{BASE_URL}/users/1"  # Assuming ID 1 exists for testing
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Happy path
    response = requests.delete(url, headers=headers)
    log_result("test_delete_user", "DELETE", "/users/1", response.status_code)

def test_no_auth():
    url = f"{BASE_URL}/users"

    # No auth
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/users", response.status_code)

def test_invalid_data():
    url = f"{BASE_URL}/users"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        # Missing required fields
        "email": "",
        "password": ""
    }

    # Invalid data
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_invalid_data", "POST", "/users", response.status_code)

def test_not_found():
    url = f"{BASE_URL}/users/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Not found
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/users/99999999", response.status_code)

def test_duplicate():
    url = f"{BASE_URL}/users"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "username": "admin",
        "email": "admin@test.com",
        "password": "141103",
        "first_name": "Admin",
        "last_name": "User",
        "phone": "1234567890",
        "role_id": 1,
        "is_active": True
    }

    # Duplicate username/email
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_duplicate", "POST", "/users", response.status_code)

def main():
    tests = [
        test_get_all_users,
        test_create_user,
        test_get_user,
        test_update_user,
        test_delete_user,
        test_no_auth,
        test_invalid_data,
        test_not_found,
        test_duplicate
    ]

    failures = 0

    for test in tests:
        try:
            test()
            if response.status_code >= 400:
                failures += 1
        except Exception as e:
            print(f"Exception occurred: {e}")
            failures += 1

    print(f"\nSummary: PASSED={len(tests)-failures}, FAILED={failures}")

    return failures

if __name__ == "__main__":
    sys.exit(main())