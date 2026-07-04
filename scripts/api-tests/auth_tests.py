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
        token = data.get("data", {}).get("token") or data.get("token")
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

def test_login():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "username": "admin",
        "password": "141103"
    }

    # Happy path
    response = requests.post(url, json=payload)
    log_result("test_login_happy_path", "POST", "/auth/login", response.status_code, payload, response.json())
    assert response.status_code == 200

    # Missing required field
    payload.pop("username")
    response = requests.post(url, json=payload)
    log_result("test_login_missing_username", "POST", "/auth/login", response.status_code, payload, response.json())
    assert response.status_code == 400

def test_logout():
    url = f"{BASE_URL}/auth/logout"

    # Happy path
    response = requests.post(url)
    log_result("test_logout_happy_path", "POST", "/auth/logout", response.status_code, None, response.json())
    assert response.status_code == 200

def test_me():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/auth/me"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_me_happy_path", "GET", "/auth/me", response.status_code, None, response.json())
    assert response.status_code == 200

    # Without token
    response = requests.get(url)
    log_result("test_me_without_token", "GET", "/auth/me", response.status_code, None, response.json())
    assert response.status_code in [401, 403]

def test_change_password():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/auth/change-password"

    # Happy path
    payload = {
        "current_password": "141103",
        "new_password": "TEST_PASS_TEMP"
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_change_password_happy_path", "POST", "/auth/change-password", response.status_code, payload, response.json())
    assert response.status_code == 200

    # Revert password change
    payload = {
        "current_password": "TEST_PASS_TEMP",
        "new_password": "141103"
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_change_password_revert", "POST", "/auth/change-password", response.status_code, payload, response.json())
    assert response.status_code == 200

    # Wrong current password
    payload = {
        "current_password": "wrongpassword",
        "new_password": "TEST_PASS_TEMP"
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_change_password_wrong_current", "POST", "/auth/change-password", response.status_code, payload, response.json())
    assert response.status_code == 400

def main():
    tests = [
        test_login,
        test_logout,
        test_me,
        test_change_password
    ]

    failures = 0

    for test in tests:
        try:
            test()
        except AssertionError:
            failures += 1

    print(f"Tests completed: {len(tests) - failures} PASSED, {failures} FAILED")
    return failures

if __name__ == "__main__":
    sys.exit(main())