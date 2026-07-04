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
        return response.json()["data"]["token"]
    else:
        raise Exception("Failed to get token")

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

def test_list_po():
    token = get_token()
    url = f"{BASE_URL}/purchase-orders"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_po", "GET", url, response.status_code)
    assert response.status_code == 200

def test_create_po(token):
    url = f"{BASE_URL}/purchase-orders"
    payload = {
        "supplier_id": 1,
        "warehouse_id": 1,
        "order_date": time.strftime("%Y-%m-%d"),
        "notes": "API_TEST_DELETE_PO_" + time.strftime("%Y%m%d%H%M%S"),
        "items": [
            {
                "product_id": 1,
                "presentation_id": 1,
                "package_quantity": 1,
                "package_cost": 10.0,
                "loose_units": 0,
                "unit_cost": 0
            }
        ]
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_po", "POST", url, response.status_code, payload, response.json())
    assert response.status_code == 201
    return response.json()["data"]["id"]

def test_get_po(token, po_id):
    url = f"{BASE_URL}/purchase-orders/{po_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    log_result("test_get_po", "GET", url, response.status_code)
    assert response.status_code == 200

def test_update_po(token, po_id):
    url = f"{BASE_URL}/purchase-orders/{po_id}"
    payload = {
        "notes": "Updated notes"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_po", "PUT", url, response.status_code, payload, response.json())
    assert response.status_code == 200

def test_no_auth():
    url = f"{BASE_URL}/purchase-orders"
    response = requests.get(url)
    log_result("test_no_auth", "GET", url, response.status_code)
    assert response.status_code in [401, 403]

def test_not_found(token):
    url = f"{BASE_URL}/purchase-orders/99999999"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", url, response.status_code)
    assert response.status_code == 404

def test_duplicate(token):
    url = f"{BASE_URL}/purchase-orders"
    payload = {
        "supplier_id": 1,
        "warehouse_id": 1,
        "order_date": time.strftime("%Y-%m-%d"),
        "notes": "API_TEST_DELETE_PO_" + time.strftime("%Y%m%d%H%M%S"),
        "items": [
            {
                "product_id": 1,
                "presentation_id": 1,
                "package_quantity": 1,
                "package_cost": 10.0,
                "loose_units": 0,
                "unit_cost": 0
            }
        ]
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_duplicate", "POST", url, response.status_code, payload, response.json())
    assert response.status_code == 409

def test_delete_po(token, po_id):
    url = f"{BASE_URL}/purchase-orders/{po_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.delete(url, headers=headers)
    log_result("test_delete_po", "DELETE", url, response.status_code)
    assert response.status_code == 204

def main():
    token = get_token()
    po_id = None
    failures = 0

    try:
        test_list_po()

        po_id = test_create_po(token)

        if po_id:
            test_get_po(token, po_id)
            test_update_po(token, po_id)

        test_no_auth()
        test_not_found(token)
        test_duplicate(token)

        if po_id:
            test_delete_po(token, po_id)

    except AssertionError as e:
        failures += 1
        print(f"FAILED: {e}")

    finally:
        if po_id:
            try:
                test_delete_po(token, po_id)
            except Exception as e:
                print(f"Cleanup failed: {e}")

    return failures

if __name__ == "__main__":
    sys.exit(main())