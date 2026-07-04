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
        "response": json.dumps(resp, default=str)
    }
    print(json.dumps(result))

def test_list_banks():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/banks", headers=headers)
    log_result("test_list_banks_happy_path", "GET", "/banks", response.status_code, {}, response.json())

    # Without token
    response = requests.get(f"{BASE_URL}/banks")
    log_result("test_list_banks_no_token", "GET", "/banks", response.status_code, {}, response.json())

def test_create_bank():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    payload = {
        "name": f"API_TEST_DELETE_{int(time.time())}",
        "currency": "USD",
        "type": "bank"
    }
    response = requests.post(f"{BASE_URL}/banks", headers=headers, json=payload)
    log_result("test_create_bank_happy_path", "POST", "/banks", response.status_code, payload, response.json())

    if response.status_code == 201:
        return response.json()["data"]
    else:
        return None

def test_get_bank(bank_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/banks/{bank_id}", headers=headers)
    log_result("test_get_bank_happy_path", "GET", f"/banks/{bank_id}", response.status_code, {}, response.json())

def test_update_bank(bank_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    payload = {
        "name": f"API_TEST_UPDATE_{int(time.time())}",
        "currency": "COP",
        "type": "wallet"
    }
    response = requests.put(f"{BASE_URL}/banks/{bank_id}", headers=headers, json=payload)
    log_result("test_update_bank_happy_path", "PUT", f"/banks/{bank_id}", response.status_code, payload, response.json())

def test_delete_bank(bank_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.delete(f"{BASE_URL}/banks/{bank_id}", headers=headers)
    log_result("test_delete_bank_happy_path", "DELETE", f"/banks/{bank_id}", response.status_code, {}, response.json())

def main():
    failures = 0

    # Test list banks (only GET endpoint available)
    test_list_banks()

    # Note: POST, PUT, DELETE endpoints not implemented in backend
    # Only GET /banks is available

    return failures

if __name__ == "__main__":
    sys.exit(main())