import requests
import json
import sys
import time

BASE_URL = "http://localhost:5001/api"

def get_token():
    url = f"{BASE_URL}/auth/login"
    payload = {"username": "admin", "password": "141103"}
    response = requests.post(url, json=payload)
    return response.json()["data"]["token"]

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

def test_list_prl():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists"
    response = requests.get(url, headers=headers)
    log_result("test_list_prl", "GET", "/price-lists", response.status_code)
    return response.json()["data"]

def test_create_prl():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists"
    payload = {
        "name": f"API_TEST_DELETE_{int(time.time())}",
        "description": "Test description",
        "valid_from": "2023-01-01",
        "validity_days": 365
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_create_prl", "POST", "/price-lists", response.status_code, payload, response.json())
    return response.json()["data"]

def test_get_prl(prl_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists/{prl_id}"
    response = requests.get(url, headers=headers)
    log_result("test_get_prl", "GET", f"/price-lists/{prl_id}", response.status_code)

def test_update_prl(prl_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists/{prl_id}"
    payload = {
        "name": f"API_TEST_UPDATE_{int(time.time())}",
        "description": "Updated description",
        "valid_from": "2023-01-01",
        "validity_days": 365
    }
    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_prl", "PUT", f"/price-lists/{prl_id}", response.status_code, payload, response.json())

def test_delete_prl(prl_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists/{prl_id}"
    response = requests.delete(url, headers=headers)
    log_result("test_delete_prl", "DELETE", f"/price-lists/{prl_id}", response.status_code)

def test_no_auth():
    url = f"{BASE_URL}/price-lists"
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/price-lists", response.status_code)

def test_not_found():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists/99999999"
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/price-lists/99999999", response.status_code)

def test_duplicate():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/price-lists"
    payload = {
        "name": "API_TEST_DUPLICATE",
        "description": "Test description",
        "valid_from": "2023-01-01",
        "validity_days": 365
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_duplicate", "POST", "/price-lists", response.status_code, payload, response.json())

def main():
    prl_id = None
    failures = 0

    try:
        test_no_auth()
        test_not_found()

        prls = test_list_prl()
        if not prls:
            print("No existing PRLs found to test against.")
            return 1

        prl_id = test_create_prl()["id"]
        if not prl_id:
            failures += 1
            raise Exception("Failed to create PRL")

        test_get_prl(prl_id)
        test_update_prl(prl_id)

        test_duplicate()

    except Exception as e:
        print(f"Error: {e}")
        failures += 1

    finally:
        if prl_id:
            test_delete_prl(prl_id)

    return failures

if __name__ == "__main__":
    sys.exit(main())