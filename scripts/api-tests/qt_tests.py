import requests
import json
import sys
import time

BASE_URL = "http://localhost:5001/api"

def get_token():
    response = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "141103"})
    if response.status_code != 200:
        raise Exception("Failed to get token")
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

def test_list_quotes():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/quotes", headers=headers)
    log_result("test_list_quotes_happy_path", "GET", "/quotes", response.status_code, None, response.json())
    if response.status_code != 200:
        return False

    # Without token
    response = requests.get(f"{BASE_URL}/quotes")
    log_result("test_list_quotes_without_token", "GET", "/quotes", response.status_code, None, response.json())

    return True

def test_create_quote():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    timestamp = int(time.time())
    quote_data = {
        "customer_id": 1,
        "notes": f"API_TEST_DELETE_QUOTE_{timestamp}",
        "details": [
            {
                "productId": 1,
                "quantity": 2,
                "unitPrice": 10.0
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=quote_data)
    log_result("test_create_quote_happy_path", "POST", "/quotes", response.status_code, quote_data, response.json())
    if response.status_code != 201:
        return False

    # Without token
    response = requests.post(f"{BASE_URL}/quotes", json=quote_data)
    log_result("test_create_quote_without_token", "POST", "/quotes", response.status_code, quote_data, response.json())

    # Invalid data (missing required field)
    invalid_quote_data = {
        "customer_id": 1,
        "notes": f"API_TEST_DELETE_QUOTE_{timestamp}",
        "details": []
    }
    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=invalid_quote_data)
    log_result("test_create_quote_invalid_data", "POST", "/quotes", response.status_code, invalid_quote_data, response.json())

    # Duplicate (same customer_id and notes)
    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=quote_data)
    log_result("test_create_quote_duplicate", "POST", "/quotes", response.status_code, quote_data, response.json())

    return True

def test_get_quote():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    timestamp = int(time.time())
    quote_data = {
        "customer_id": 1,
        "notes": f"API_TEST_DELETE_QUOTE_{timestamp}",
        "details": [
            {
                "productId": 1,
                "quantity": 2,
                "unitPrice": 10.0
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=quote_data)
    if response.status_code != 201:
        return False

    quote_id = response.json()["data"]["id"]
    response = requests.get(f"{BASE_URL}/quotes/{quote_id}", headers=headers)
    log_result("test_get_quote_happy_path", "GET", f"/quotes/{quote_id}", response.status_code, None, response.json())
    if response.status_code != 200:
        return False

    # Without token
    response = requests.get(f"{BASE_URL}/quotes/{quote_id}")
    log_result("test_get_quote_without_token", "GET", f"/quotes/{quote_id}", response.status_code, None, response.json())

    # Resource not found
    response = requests.get(f"{BASE_URL}/quotes/99999999", headers=headers)
    log_result("test_get_quote_not_found", "GET", "/quotes/99999999", response.status_code, None, response.json())

    return True

def test_update_quote():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    timestamp = int(time.time())
    quote_data = {
        "customer_id": 1,
        "notes": f"API_TEST_DELETE_QUOTE_{timestamp}",
        "details": [
            {
                "productId": 1,
                "quantity": 2,
                "unitPrice": 10.0
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=quote_data)
    if response.status_code != 201:
        return False

    quote_id = response.json()["data"]["id"]
    update_data = {
        "notes": f"API_TEST_UPDATE_QUOTE_{timestamp}"
    }

    response = requests.put(f"{BASE_URL}/quotes/{quote_id}", headers=headers, json=update_data)
    log_result("test_update_quote_happy_path", "PUT", f"/quotes/{quote_id}", response.status_code, update_data, response.json())
    if response.status_code != 200:
        return False

    # Without token
    response = requests.put(f"{BASE_URL}/quotes/{quote_id}", json=update_data)
    log_result("test_update_quote_without_token", "PUT", f"/quotes/{quote_id}", response.status_code, update_data, response.json())

    # Resource not found
    response = requests.put(f"{BASE_URL}/quotes/99999999", headers=headers, json=update_data)
    log_result("test_update_quote_not_found", "PUT", "/quotes/99999999", response.status_code, update_data, response.json())

    return True

def test_delete_quote():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    timestamp = int(time.time())
    quote_data = {
        "customer_id": 1,
        "notes": f"API_TEST_DELETE_QUOTE_{timestamp}",
        "details": [
            {
                "productId": 1,
                "quantity": 2,
                "unitPrice": 10.0
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/quotes", headers=headers, json=quote_data)
    if response.status_code != 201:
        return False

    quote_id = response.json()["data"]["id"]
    response = requests.delete(f"{BASE_URL}/quotes/{quote_id}", headers=headers)
    log_result("test_delete_quote_happy_path", "DELETE", f"/quotes/{quote_id}", response.status_code, None, response.json())
    if response.status_code not in [200, 204]:
        return False

    # Without token
    response = requests.delete(f"{BASE_URL}/quotes/{quote_id}")
    log_result("test_delete_quote_without_token", "DELETE", f"/quotes/{quote_id}", response.status_code, None, response.json())

    # Resource not found
    response = requests.delete(f"{BASE_URL}/quotes/99999999", headers=headers)
    log_result("test_delete_quote_not_found", "DELETE", "/quotes/99999999", response.status_code, None, response.json())

    return True

def main():
    tests = [
        test_list_quotes,
        test_create_quote,
        test_get_quote,
        test_update_quote,
        test_delete_quote
    ]

    failures = 0
    for test in tests:
        if not test():
            failures += 1

    print(f"Tests completed: {len(tests) - failures} PASSED, {failures} FAILED")
    return failures

if __name__ == "__main__":
    sys.exit(main())