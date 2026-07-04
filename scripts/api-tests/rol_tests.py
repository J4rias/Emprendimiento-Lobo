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

    print(json.dumps(result, ensure_ascii=False))

def test_get_all_roles():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/roles", headers=headers)
    log_result("test_get_all_roles_happy_path", "GET", "/roles", response.status_code, None, response.json())

    # Without token
    response = requests.get(f"{BASE_URL}/roles")
    log_result("test_get_all_roles_no_auth", "GET", "/roles", response.status_code)

def test_create_role():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    timestamp = str(int(time.time()))
    payload = {
        "name": f"API_TEST_DELETE_{timestamp}",
        "description": "Test Role",
        "is_active": True,
        "permissions": []
    }

    # Happy path
    response = requests.post(f"{BASE_URL}/roles", headers=headers, json=payload)
    log_result("test_create_role_happy_path", "POST", "/roles", response.status_code, payload, response.json())

    if response.status_code == 201:
        return response.json()['data']['id']
    else:
        print(f"Failed to create role: {response.text}")
        return None

def test_get_role_by_id(role_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/roles/{role_id}", headers=headers)
    log_result("test_get_role_by_id_happy_path", "GET", f"/roles/{role_id}", response.status_code, None, response.json())

    # Without token
    response = requests.get(f"{BASE_URL}/roles/{role_id}")
    log_result("test_get_role_by_id_no_auth", "GET", f"/roles/{role_id}", response.status_code)

def test_update_role(role_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": f"API_TEST_UPDATE_{int(time.time())}",
        "description": "Updated Test Role",
        "is_active": False,
        "permissions": []
    }

    # Happy path
    response = requests.put(f"{BASE_URL}/roles/{role_id}", headers=headers, json=payload)
    log_result("test_update_role_happy_path", "PUT", f"/roles/{role_id}", response.status_code, payload, response.json())

def test_delete_role(role_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.delete(f"{BASE_URL}/roles/{role_id}", headers=headers)
    log_result("test_delete_role_happy_path", "DELETE", f"/roles/{role_id}", response.status_code, None, response.json())

def main():
    role_id = test_create_role()

    if not role_id:
        print("Failed to create a role for testing.")
        return 1

    try:
        test_get_all_roles()
        test_get_role_by_id(role_id)
        test_update_role(role_id)

        # Test error cases
        response = requests.get(f"{BASE_URL}/roles/99999999", headers={"Authorization": f"Bearer {get_token()}"})
        log_result("test_get_nonexistent_role", "GET", "/roles/99999999", response.status_code)

    finally:
        test_delete_role(role_id)

    return 0

if __name__ == "__main__":
    sys.exit(main())