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
        "response": json.dumps(resp, ensure_ascii=False)
    }
    print(json.dumps(result, ensure_ascii=False))

def test_get_inventory():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/inventory"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_inventory_happy_path", "GET", "/inventory", response.status_code, {}, response.json())

    # Without token
    response = requests.get(url)
    log_result("test_get_inventory_without_token", "GET", "/inventory", response.status_code, {}, response.json())

def test_adjust_inventory():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/inventory/adjust"

    # Happy path
    payload = {
        "product_id": 1,
        "warehouse_id": 1,
        "quantity": 10.0,
        "reason": "API Test Adjustment"
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_adjust_inventory_happy_path", "POST", "/inventory/adjust", response.status_code, payload, response.json())

    # Without token
    response = requests.post(url, json=payload)
    log_result("test_adjust_inventory_without_token", "POST", "/inventory/adjust", response.status_code, payload, response.json())

def test_get_movements():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/inventory/movements"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_movements_happy_path", "GET", "/inventory/movements", response.status_code, {}, response.json())

    # Without token
    response = requests.get(url)
    log_result("test_get_movements_without_token", "GET", "/inventory/movements", response.status_code, {}, response.json())

def main():
    tests = [
        test_get_inventory,
        test_adjust_inventory,
        test_get_movements
    ]

    failures = 0

    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"Error executing {test.__name__}: {e}")
            failures += 1

    return failures

if __name__ == "__main__":
    sys.exit(main())