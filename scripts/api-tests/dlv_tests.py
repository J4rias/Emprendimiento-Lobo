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

def test_list_deliveries():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/deliveries"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_list_deliveries", "GET", "/deliveries", response.status_code)

    # Without token
    response = requests.get(url)
    log_result("test_list_deliveries_no_auth", "GET", "/deliveries", response.status_code)

def test_create_delivery():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/deliveries"

    # Happy path
    payload = {
        "sale_id": 1,  # Assuming there's at least one sale with ID 1
        "delivery_address": "Test Address",
        "delivery_city": "Test City",
        "delivery_state": "Test State",
        "contact_name": "Test Contact",
        "contact_phone": "1234567890"
    }
    response = requests.post(url, headers=headers, json=payload)
    log_result("test_create_delivery", "POST", "/deliveries", response.status_code)

    # Without token
    response = requests.post(url, json=payload)
    log_result("test_create_delivery_no_auth", "POST", "/deliveries", response.status_code)

def test_get_delivery():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/deliveries/1"

    # Happy path
    response = requests.get(url, headers=headers)
    log_result("test_get_delivery", "GET", "/deliveries/1", response.status_code)

    # Without token
    response = requests.get(url)
    log_result("test_get_delivery_no_auth", "GET", "/deliveries/1", response.status_code)

def test_update_delivery():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/deliveries/1"

    # Happy path
    payload = {
        "delivery_address": "Updated Test Address"
    }
    response = requests.put(url, headers=headers, json=payload)
    log_result("test_update_delivery", "PUT", "/deliveries/1", response.status_code)

    # Without token
    response = requests.put(url, json=payload)
    log_result("test_update_delivery_no_auth", "PUT", "/deliveries/1", response.status_code)

def test_delete_delivery():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/deliveries/1"

    # Happy path
    response = requests.delete(url, headers=headers)
    log_result("test_delete_delivery", "DELETE", "/deliveries/1", response.status_code)

    # Without token
    response = requests.delete(url)
    log_result("test_delete_delivery_no_auth", "DELETE", "/deliveries/1", response.status_code)

def main():
    tests = [
        test_list_deliveries,
        test_create_delivery,
        test_get_delivery,
        test_update_delivery,
        test_delete_delivery
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