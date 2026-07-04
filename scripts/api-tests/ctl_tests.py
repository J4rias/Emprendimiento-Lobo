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

def log_result(test, method, path, status, req=None, resp=None):
    result = {
        "test": test,
        "method": method,
        "path": path,
        "status": status,
        "request": req,
        "response": resp
    }
    print(json.dumps(result, ensure_ascii=False))

def test_get_catalog():
    url = f"{BASE_URL}/catalog"
    response = requests.get(url)
    log_result("test_get_catalog", "GET", "/catalog", response.status_code, None, response.json())

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    data = response.json()
    assert "company" in data, "Company information missing from response"
    assert "priceList" in data, "Price list missing from response"
    assert "categories" in data, "Categories missing from response"
    assert "products" in data, "Products missing from response"
    assert "topProducts" in data, "Top products missing from response"
    assert "newArrivals" in data, "New arrivals missing from response"

def main():
    tests = [
        test_get_catalog
    ]

    failures = 0

    for test in tests:
        try:
            test()
        except AssertionError as e:
            print(f"FAILED: {test.__name__} - {str(e)}")
            failures += 1
        else:
            print(f"PASSED: {test.__name__}")

    print(f"\nRESUMEN: PASSED={len(tests)-failures}, FAILED={failures}")
    return failures

if __name__ == "__main__":
    sys.exit(main())