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

def log_result(test_name, method, path, status_code, request_data=None, response_data=None):
    result = {
        "test": test_name,
        "method": method,
        "path": path,
        "status_code": status_code
    }
    if request_data:
        result["request"] = json.dumps(request_data)
    if response_data:
        result["response"] = json.dumps(response_data)
    print(json.dumps(result))

def test_list_payments():
    url = f"{BASE_URL}/supplier-payments"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)

    log_result("test_list_payments", "GET", "/supplier-payments", response.status_code)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to list payments: {response.text}")

def test_create_payment():
    url = f"{BASE_URL}/supplier-payments"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "supplier_id": 1,
        "purchase_order_id": 1,
        "payment_date": "2023-10-05",
        "payment_method": "transfer",
        "amount": 100.00,
        "currency": "USD",
        "reference": "Test Reference",
        "status": "recorded"
    }
    response = requests.post(url, json=payload, headers=headers)

    log_result("test_create_payment", "POST", "/supplier-payments", response.status_code, payload)
    if response.status_code == 201:
        return response.json()
    else:
        raise Exception(f"Failed to create payment: {response.text}")

def test_get_payment(payment_id):
    url = f"{BASE_URL}/supplier-payments/{payment_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)

    log_result("test_get_payment", "GET", f"/supplier-payments/{payment_id}", response.status_code)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to get payment: {response.text}")

def test_update_payment(payment_id):
    url = f"{BASE_URL}/supplier-payments/{payment_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "amount": 150.00,
        "status": "confirmed"
    }
    response = requests.put(url, json=payload, headers=headers)

    log_result("test_update_payment", "PUT", f"/supplier-payments/{payment_id}", response.status_code, payload)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to update payment: {response.text}")

def test_delete_payment(payment_id):
    url = f"{BASE_URL}/supplier-payments/{payment_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.delete(url, headers=headers)

    log_result("test_delete_payment", "DELETE", f"/supplier-payments/{payment_id}", response.status_code)
    if response.status_code in [200, 204]:
        return True
    else:
        raise Exception(f"Failed to delete payment: {response.text}")

def test_no_auth():
    url = f"{BASE_URL}/supplier-payments"
    response = requests.get(url)

    log_result("test_no_auth", "GET", "/supplier-payments", response.status_code)
    if response.status_code in [401, 403]:
        return True
    else:
        raise Exception(f"Failed to test no auth: {response.text}")

def test_invalid_data():
    url = f"{BASE_URL}/supplier-payments"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "amount": -100.00,  # Invalid amount
        "currency": "INVALID_CURRENCY"
    }
    response = requests.post(url, json=payload, headers=headers)

    log_result("test_invalid_data", "POST", "/supplier-payments", response.status_code, payload)
    if response.status_code == 400:
        return True
    else:
        raise Exception(f"Failed to test invalid data: {response.text}")

def test_not_found():
    url = f"{BASE_URL}/supplier-payments/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)

    log_result("test_not_found", "GET", "/supplier-payments/99999999", response.status_code)
    if response.status_code == 404:
        return True
    else:
        raise Exception(f"Failed to test not found: {response.text}")

def main():
    try:
        # List payments to get an existing ID for testing
        list_response = test_list_payments()
        payment_id = list_response["data"][0]["id"] if list_response["data"] else None

        if not payment_id:
            raise Exception("No payments found to test")

        # Create a new payment
        create_response = test_create_payment()
        created_payment_id = create_response["data"]["id"]

        # Test GET, UPDATE with the newly created payment
        test_get_payment(created_payment_id)
        test_update_payment(created_payment_id)

        # Test error cases
        test_no_auth()
        test_invalid_data()
        test_not_found()

        # Cleanup: Delete the created payment
        test_delete_payment(created_payment_id)

    except Exception as e:
        print(f"Error: {e}")
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())