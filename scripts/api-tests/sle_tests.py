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

def test_sales_list():
    token = get_token()
    url = f"{BASE_URL}/sales"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_sales_list", "GET", "/sales", response.status_code, None, response.json())
    return response

def test_sale_create(token):
    url = f"{BASE_URL}/sales"
    payload = {
        "customer_id": 1,
        "items": [
            {
                "product_id": 1,
                "quantity": 2,
                "price": 10.0
            }
        ],
        "total_amount": 20.0
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_sale_create", "POST", "/sales", response.status_code, payload, response.json())
    return response

def test_sale_get(token, sale_id):
    url = f"{BASE_URL}/sales/{sale_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_sale_get", "GET", f"/sales/{sale_id}", response.status_code, None, response.json())
    return response

def test_sale_update(token, sale_id):
    url = f"{BASE_URL}/sales/{sale_id}"
    payload = {
        "customer_id": 1,
        "items": [
            {
                "product_id": 2,
                "quantity": 3,
                "price": 15.0
            }
        ],
        "total_amount": 45.0
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.patch(url, json=payload, headers=headers)
    log_result("test_sale_update", "PATCH", f"/sales/{sale_id}", response.status_code, payload, response.json())
    return response

def test_sale_no_auth():
    url = f"{BASE_URL}/sales"
    response = requests.get(url)
    log_result("test_sale_no_auth", "GET", "/sales", response.status_code, None, response.json())

def test_sale_not_found(token):
    url = f"{BASE_URL}/sales/99999999"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_sale_not_found", "GET", "/sales/99999999", response.status_code, None, response.json())

def test_sale_duplicate(token):
    url = f"{BASE_URL}/sales"
    payload = {
        "customer_id": 1,
        "items": [
            {
                "product_id": 1,
                "quantity": 2,
                "price": 10.0
            }
        ],
        "total_amount": 20.0
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_sale_duplicate", "POST", "/sales", response.status_code, payload, response.json())

def test_sale_delete(token, sale_id):
    url = f"{BASE_URL}/sales/{sale_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers)
    log_result("test_sale_delete", "DELETE", f"/sales/{sale_id}", response.status_code, None, response.json())

def main():
    token = get_token()
    sale_response = test_sales_list()

    if sale_response.status_code == 200:
        sales_data = sale_response.json()["data"]
        if len(sales_data) > 0:
            sale_id = sales_data[0]["id"]
        else:
            create_response = test_sale_create(token)
            if create_response.status_code == 201:
                sale_id = create_response.json()["data"]["id"]
            else:
                print("Failed to create a sale for testing")
                return 1
    else:
        print("Failed to list sales")
        return 1

    test_sale_get(token, sale_id)
    test_sale_update(token, sale_id)
    test_sale_no_auth()
    test_sale_not_found(token)
    test_sale_duplicate(token)

    try:
        test_sale_delete(token, sale_id)
    except Exception as e:
        print(f"Error during cleanup: {e}")

    return 0

if __name__ == "__main__":
    sys.exit(main())