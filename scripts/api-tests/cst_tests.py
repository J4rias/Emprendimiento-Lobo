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

def test_list_customers(token):
    url = f"{BASE_URL}/customers"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_customers", "GET", "/customers", response.status_code, None, response.json())
    return response

def test_create_customer(token, document_number):
    url = f"{BASE_URL}/customers"
    payload = {
        "code": "API_TEST_DELETE_CST_" + str(int(time.time())),
        "type": "natural",
        "documentType": "V",
        "documentNumber": document_number,
        "firstName": "Test",
        "lastName": "User",
        "email": "test@example.com",
        "phone": "1234567890",
        "mobile": "0987654321",
        "address": "Test Address",
        "city": "Test City",
        "state": "Test State",
        "country": "Venezuela",
        "postalCode": "1000",
        "creditLimit": 1000.0,
        "creditDays": 30,
        "priceListId": 1,
        "discountPercentage": 5.0,
        "status": "active"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_customer", "POST", "/customers", response.status_code, payload, response.json())
    return response

def test_get_customer(token, customer_id):
    url = f"{BASE_URL}/customers/{customer_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    log_result("test_get_customer", "GET", f"/customers/{customer_id}", response.status_code, None, response.json())
    return response

def test_update_customer(token, customer_id):
    url = f"{BASE_URL}/customers/{customer_id}"
    payload = {
        "firstName": "Updated Test",
        "lastName": "Updated User"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_customer", "PUT", f"/customers/{customer_id}", response.status_code, payload, response.json())
    return response

def test_delete_customer(token, customer_id):
    url = f"{BASE_URL}/customers/{customer_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.delete(url, headers=headers)
    log_result("test_delete_customer", "DELETE", f"/customers/{customer_id}", response.status_code, None, response.json())
    return response

def test_list_customers_no_auth():
    url = f"{BASE_URL}/customers"
    response = requests.get(url)
    log_result("test_list_customers_no_auth", "GET", "/customers", response.status_code, None, response.json())

def test_get_customer_not_found(token):
    url = f"{BASE_URL}/customers/99999999"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    log_result("test_get_customer_not_found", "GET", "/customers/99999999", response.status_code, None, response.json())

def test_create_duplicate_customer(token, document_number):
    url = f"{BASE_URL}/customers"
    payload = {
        "code": "API_TEST_DELETE_CST_" + str(int(time.time())),
        "type": "natural",
        "documentType": "V",
        "documentNumber": document_number,  # Duplicate document number
        "firstName": "Test",
        "lastName": "User",
        "email": "test@example.com",
        "phone": "1234567890",
        "mobile": "0987654321",
        "address": "Test Address",
        "city": "Test City",
        "state": "Test State",
        "country": "Venezuela",
        "postalCode": "1000",
        "creditLimit": 1000.0,
        "creditDays": 30,
        "priceListId": 1,
        "discountPercentage": 5.0,
        "status": "active"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_customer", "POST", "/customers", response.status_code, payload, response.json())

def main():
    token = get_token()
    failures = 0
    document_number = "TEST" + str(int(time.time()))

    # List customers
    list_response = test_list_customers(token)
    if list_response.status_code != 200:
        failures += 1

    # Create customer
    create_response = test_create_customer(token, document_number)
    if create_response.status_code != 201:
        failures += 1
    else:
        customer_id = create_response.json()["data"]["id"]

        # Get customer
        get_response = test_get_customer(token, customer_id)
        if get_response.status_code != 200:
            failures += 1

        # Update customer
        update_response = test_update_customer(token, customer_id)
        if update_response.status_code != 200:
            failures += 1

        # Test duplicate BEFORE delete (same document_number still exists)
        test_create_duplicate_customer(token, document_number)

        # Delete customer
        delete_response = test_delete_customer(token, customer_id)
        if delete_response.status_code != 204:
            failures += 1

    # Test cases without auth and errors
    test_list_customers_no_auth()
    test_get_customer_not_found(token)

    return failures

if __name__ == "__main__":
    sys.exit(main())