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

def test_list_exchange_rates():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates"
    response = requests.get(url, headers=headers)
    log_result("test_list_exchange_rates", "GET", url, response.status_code)
    assert response.status_code == 200

def test_create_exchange_rate():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates"
    payload = {
        "from_currency": "USD",
        "to_currency": "VES",
        "rate": 10.5,
        "effective_date": "2023-10-01",
        "source": "API_TEST",
        "notes": "Test note"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_exchange_rate", "POST", url, response.status_code, payload, response.json())
    assert response.status_code == 201
    return response.json()["data"]

def test_get_exchange_rate(exchange_rate_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates/{exchange_rate_id}"
    response = requests.get(url, headers=headers)
    log_result("test_get_exchange_rate", "GET", url, response.status_code)
    assert response.status_code == 200

def test_update_exchange_rate(exchange_rate_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates/{exchange_rate_id}"
    payload = {
        "rate": 11.5,
        "notes": "Updated test note"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_exchange_rate", "PUT", url, response.status_code, payload, response.json())
    assert response.status_code == 200

def test_delete_exchange_rate(exchange_rate_id):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates/{exchange_rate_id}"
    response = requests.delete(url, headers=headers)
    log_result("test_delete_exchange_rate", "DELETE", url, response.status_code)
    assert response.status_code == 200

def test_list_without_auth():
    url = f"{BASE_URL}/exchange-rates"
    response = requests.get(url)
    log_result("test_list_without_auth", "GET", url, response.status_code)
    assert response.status_code in [401, 403]

def test_get_nonexistent_exchange_rate():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates/99999999"
    response = requests.get(url, headers=headers)
    log_result("test_get_nonexistent_exchange_rate", "GET", url, response.status_code)
    assert response.status_code == 404

def test_create_duplicate_exchange_rate():
    # Exchange rates are unique by (from_currency, to_currency, effective_date)
    # This test runs after test_delete_exchange_rate freed the "2023-10-01" date slot
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/exchange-rates"
    payload = {
        "from_currency": "USD",
        "to_currency": "VES",
        "rate": 10.5,
        "effective_date": "2023-10-01",
        "source": "API_TEST",
        "notes": "Test note"
    }
    # First create should succeed (slot was freed by delete test above)
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_exchange_rate", "POST", url, response.status_code, payload, response.json())
    assert response.status_code == 201
    created_id = response.json()["data"]["id"]

    # Second create with same key should fail with 409
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_exchange_rate_conflict", "POST", url, response.status_code, payload, response.json())
    assert response.status_code == 409

    # Clean up so next run doesn't conflict
    requests.delete(f"{url}/{created_id}", headers=headers)

def main():
    failures = 0
    try:
        test_list_exchange_rates()
        exchange_rate = test_create_exchange_rate()
        test_get_exchange_rate(exchange_rate["id"])
        test_update_exchange_rate(exchange_rate["id"])
        test_delete_exchange_rate(exchange_rate["id"])
        test_list_without_auth()
        test_get_nonexistent_exchange_rate()
        test_create_duplicate_exchange_rate()
    except AssertionError:
        failures += 1
    return failures

if __name__ == "__main__":
    sys.exit(main())