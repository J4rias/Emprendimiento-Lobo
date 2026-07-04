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

def test_get_customers():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/accounts-receivable/customers", headers=headers)
    log_result("test_get_customers_happy_path", "GET", "/accounts-receivable/customers", response.status_code)

    # Without token
    response = requests.get(f"{BASE_URL}/accounts-receivable/customers")
    log_result("test_get_customers_no_auth", "GET", "/accounts-receivable/customers", response.status_code)

def test_create_customer():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    payload = {
        "name": f"API_TEST_DELETE_CUSTOMER_{int(time.time())}",
        "email": "test@example.com",
        "phone": "1234567890"
    }
    response = requests.post(f"{BASE_URL}/accounts-receivable/customers", headers=headers, json=payload)
    log_result("test_create_customer_happy_path", "POST", "/accounts-receivable/customers", response.status_code)

    # Without token
    response = requests.post(f"{BASE_URL}/accounts-receivable/customers", json=payload)
    log_result("test_create_customer_no_auth", "POST", "/accounts-receivable/customers", response.status_code)

def test_get_customer():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    customer_id = 1  # Assuming there is at least one customer with ID 1
    response = requests.get(f"{BASE_URL}/accounts-receivable/customers/{customer_id}", headers=headers)
    log_result("test_get_customer_happy_path", "GET", f"/accounts-receivable/customers/{customer_id}", response.status_code)

    # Without token
    response = requests.get(f"{BASE_URL}/accounts-receivable/customers/{customer_id}")
    log_result("test_get_customer_no_auth", "GET", f"/accounts-receivable/customers/{customer_id}", response.status_code)

def test_update_customer():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    customer_id = 1  # Assuming there is at least one customer with ID 1
    payload = {
        "name": "Updated Customer Name",
        "email": "updated@example.com",
        "phone": "0987654321"
    }
    response = requests.put(f"{BASE_URL}/accounts-receivable/customers/{customer_id}", headers=headers, json=payload)
    log_result("test_update_customer_happy_path", "PUT", f"/accounts-receivable/customers/{customer_id}", response.status_code)

    # Without token
    response = requests.put(f"{BASE_URL}/accounts-receivable/customers/{customer_id}", json=payload)
    log_result("test_update_customer_no_auth", "PUT", f"/accounts-receivable/customers/{customer_id}", response.status_code)

def test_delete_customer():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    customer_id = 1  # Assuming there is at least one customer with ID 1
    response = requests.delete(f"{BASE_URL}/accounts-receivable/customers/{customer_id}", headers=headers)
    log_result("test_delete_customer_happy_path", "DELETE", f"/accounts-receivable/customers/{customer_id}", response.status_code)

    # Without token
    response = requests.delete(f"{BASE_URL}/accounts-receivable/customers/{customer_id}")
    log_result("test_delete_customer_no_auth", "DELETE", f"/accounts-receivable/customers/{customer_id}", response.status_code)

def main():
    tests = [
        test_get_customers,
        test_create_customer,
        test_get_customer,
        test_update_customer,
        test_delete_customer
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