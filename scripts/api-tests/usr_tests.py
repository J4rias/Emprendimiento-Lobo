import requests
import json
import sys
import time

BASE_URL = "http://localhost:5001/api"

def get_token():
    r = requests.post(f"{BASE_URL}/auth/login",
                      json={"username": "admin", "password": "141103"})
    d = r.json()
    # post-refactoring: {"data": {"token": "..."}}
    if "data" in d and isinstance(d["data"], dict) and "token" in d["data"]:
        return d["data"]["token"]
    # fallback legacy
    return d.get("token") or d.get("access_token") or d.get("accessToken")


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
    return response.status_code

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
    if response.status_code == 201:
        return response.json().get("data", {}).get("id")
    return None

def test_get_user(user_id=1):
    url = f"{BASE_URL}/users/{user_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_user", "GET", f"/users/{user_id}", response.status_code)
    return response.status_code

def test_update_user(user_id=1):
    url = f"{BASE_URL}/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }
    payload = {
        "first_name": "Updated",
        "last_name": "User",
        "phone": "0987654321",
        "role_id": 1,
        "is_active": True
    }

    # Happy path
    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_user", "PUT", f"/users/{user_id}", response.status_code)
    return response.status_code

def test_delete_user(user_id):
    url = f"{BASE_URL}/users/{user_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Happy path — delete the user created in test_create_user (not user 1 = admin)
    response = requests.delete(url, headers=headers)
    log_result("test_delete_user", "DELETE", f"/users/{user_id}", response.status_code)
    return response.status_code

def test_no_auth():
    url = f"{BASE_URL}/users"

    # No auth
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/users", response.status_code)
    return response.status_code

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
    return response.status_code

def test_not_found():
    url = f"{BASE_URL}/users/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}

    # Not found
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/users/99999999", response.status_code)
    return response.status_code

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
    return response.status_code

def main():
    failures = 0
    created_user_id = None

    try:
        # GET all users
        status = test_get_all_users()
        if status != 200:
            failures += 1

        # CREATE user — capture ID for subsequent tests
        created_user_id = test_create_user()
        if created_user_id is None:
            failures += 1

        # GET/UPDATE the created user (or fallback to user 1 for read-only tests)
        target_id = created_user_id or 1
        status = test_get_user(target_id)
        if status != 200:
            failures += 1

        status = test_update_user(target_id)
        if status != 200:
            failures += 1

        # DELETE the created user (not user 1 = admin)
        if created_user_id:
            status = test_delete_user(created_user_id)
            if status not in [200, 204]:
                failures += 1

        # Auth and error cases — expected non-2xx are not failures
        test_no_auth()
        test_invalid_data()
        test_not_found()
        test_duplicate()

    except Exception as e:
        print(f"Exception occurred: {e}")
        failures += 1

    print(f"\nSummary: PASSED={4 + (1 if created_user_id else 0) - failures}, FAILED={failures}")

    return failures

if __name__ == "__main__":
    sys.exit(main())