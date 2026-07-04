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

def test_list_pre_orders():
    url = f"{BASE_URL}/pre-orders"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_pre_orders", "GET", "/pre-orders", response.status_code, None, response.json())
    return response.json()

def test_create_pre_order():
    url = f"{BASE_URL}/pre-orders"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "customer_id": 1,
        "warehouse_id": 1,
        "items": [
            {
                "presentation_id": 1,
                "quantity": 2
            }
        ]
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_pre_order", "POST", "/pre-orders", response.status_code, payload, response.json())
    return response.json()

def test_get_pre_order(pre_order_id):
    url = f"{BASE_URL}/pre-orders/{pre_order_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_pre_order", "GET", f"/pre-orders/{pre_order_id}", response.status_code, None, response.json())

def test_approve_pre_order(pre_order_id):
    url = f"{BASE_URL}/pre-orders/{pre_order_id}/approve"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.post(url, headers=headers)
    log_result("test_approve_pre_order", "POST", f"/pre-orders/{pre_order_id}/approve", response.status_code, None, response.json())

def test_reject_pre_order(pre_order_id):
    url = f"{BASE_URL}/pre-orders/{pre_order_id}/reject"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.post(url, headers=headers)
    log_result("test_reject_pre_order", "POST", f"/pre-orders/{pre_order_id}/reject", response.status_code, None, response.json())

def test_no_auth():
    url = f"{BASE_URL}/pre-orders"
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/pre-orders", response.status_code, None, response.json())

def test_not_found():
    url = f"{BASE_URL}/pre-orders/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/pre-orders/99999999", response.status_code, None, response.json())

def test_duplicate():
    url = f"{BASE_URL}/pre-orders"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "customer_name": "API_TEST_DELETE_PRE_ORDERS",
        "items": [
            {
                "product_id": 1,
                "quantity": 2
            }
        ]
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_duplicate", "POST", "/pre-orders", response.status_code, payload, response.json())

def main():
    failures = 0

    # List pre-orders to get existing IDs
    list_response = test_list_pre_orders()
    if list_response["data"]:
        pre_order_id = list_response["data"][0]["id"]
    else:
        print("No pre-orders found. Creating a new one for testing.")
        create_response = test_create_pre_order()
        pre_order_id = create_response["data"]["id"]

    # Test get pre-order
    test_get_pre_order(pre_order_id)

    # Test approve pre-order
    test_approve_pre_order(pre_order_id)

    # Test reject pre-order
    test_reject_pre_order(pre_order_id)

    # Test no auth
    test_no_auth()

    # Test not found
    test_not_found()

    # Test duplicate
    test_duplicate()

    # Cleanup: Delete the created pre-order
    try:
        url = f"{BASE_URL}/pre-orders/{pre_order_id}"
        headers = {"Authorization": f"Bearer {get_token()}"}
        response = requests.delete(url, headers=headers)
        log_result("cleanup_delete_pre_order", "DELETE", f"/pre-orders/{pre_order_id}", response.status_code, None, response.json())
    except Exception as e:
        print(f"Error during cleanup: {e}")

    return failures

if __name__ == "__main__":
    sys.exit(main())