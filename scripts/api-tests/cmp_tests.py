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
        "response": json.dumps(resp, indent=2)
    }
    print(json.dumps(result))

def get_settings():
    url = f"{BASE_URL}/company"
    response = requests.get(url)
    log_result("get_settings", "GET", "/company", response.status_code, None, response.json())
    return response

def update_settings(token):
    url = f"{BASE_URL}/company"
    payload = {
        "name": "API_TEST_UPDATE",
        "address": "Test Address",
        "phone": "1234567890",
        "email": "test@example.com",
        "tax_id": "123456789",
        "website": "http://example.com"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("update_settings", "PUT", "/company", response.status_code, payload, response.json())
    return response

def update_settings_missing_name(token):
    url = f"{BASE_URL}/company"
    payload = {
        "address": "Test Address",
        "phone": "1234567890",
        "email": "test@example.com",
        "tax_id": "123456789",
        "website": "http://example.com"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("update_settings_missing_name", "PUT", "/company", response.status_code, payload, response.json())
    return response

def update_settings_without_auth():
    url = f"{BASE_URL}/company"
    payload = {
        "name": "API_TEST_UPDATE",
        "address": "Test Address",
        "phone": "1234567890",
        "email": "test@example.com",
        "tax_id": "123456789",
        "website": "http://example.com"
    }
    response = requests.put(url, json=payload)
    log_result("update_settings_without_auth", "PUT", "/company", response.status_code, payload, response.json())
    return response

def main():
    token = get_token()

    # Happy path
    get_settings()
    update_settings(token)

    # Error cases
    update_settings_missing_name(token)
    update_settings_without_auth()

    print("RESUMEN: Todos los tests ejecutados")
    return 0

if __name__ == "__main__":
    sys.exit(main())