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
    if response.status_code != 200:
        print(json.dumps({"error": "Failed to get token", "status": response.status_code}))
        sys.exit(1)
    return response.json()["data"]["token"]

def log_result(test_name, method, path, status_code, request_data=None, response_data=None):
    result = {
        "test": test_name,
        "method": method,
        "path": path,
        "status_code": status_code
    }
    if request_data:
        result["request"] = request_data
    if response_data:
        result["response"] = response_data

    print(json.dumps(result))

def test_reserve_pos():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path — product_id 1187 (Aceite Agroil Soya) tiene inventario en warehouse 1
    payload = {
        "session_id": "test-session-id",
        "tab_id": "test-tab-id",
        "product_id": 1187,
        "presentation_id": 1013,
        "units_requested": 5.0
    }
    response = requests.post(f"{BASE_URL}/pos/reserve", json=payload, headers=headers)
    log_result("test_reserve_pos_happy_path", "POST", "/pos/reserve", response.status_code, payload, response.json())
    assert response.status_code == 200

    # Without token
    response = requests.post(f"{BASE_URL}/pos/reserve", json=payload)
    log_result("test_reserve_pos_no_token", "POST", "/pos/reserve", response.status_code, payload, response.json())
    assert response.status_code in [401, 403]

    # Invalid data (missing required field)
    invalid_payload = {k: v for k, v in payload.items() if k != "product_id"}
    response = requests.post(f"{BASE_URL}/pos/reserve", json=invalid_payload, headers=headers)
    log_result("test_reserve_pos_invalid_data", "POST", "/pos/reserve", response.status_code, invalid_payload, response.json())
    assert response.status_code == 400

    # Resource not found (product_id: 99999999)
    payload["product_id"] = 99999999
    response = requests.post(f"{BASE_URL}/pos/reserve", json=payload, headers=headers)
    log_result("test_reserve_pos_not_found", "POST", "/pos/reserve", response.status_code, payload, response.json())
    assert response.status_code == 404

def test_list_pos():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    response = requests.get(f"{BASE_URL}/pos/reservations", headers=headers)
    log_result("test_list_pos_happy_path", "GET", "/pos/reservations", response.status_code, None, response.json())
    assert response.status_code == 200

    # Without token
    response = requests.get(f"{BASE_URL}/pos/reservations")
    log_result("test_list_pos_no_token", "GET", "/pos/reservations", response.status_code)
    assert response.status_code in [401, 403]

def test_update_pos():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path
    payload = {
        "session_id": "test-session-id",
        "tab_id": "test-tab-id",
        "product_id": 1,
        "presentation_id": 1,
        "units_requested": 5.0
    }
    response = requests.post(f"{BASE_URL}/pos/reserve", json=payload, headers=headers)
    assert response.status_code == 200

    # Update the reservation (same endpoint, different quantity)
    payload["units_requested"] = 10.0
    response = requests.post(f"{BASE_URL}/pos/reserve", json=payload, headers=headers)
    log_result("test_update_pos_happy_path", "POST", "/pos/reserve", response.status_code, payload, response.json())
    assert response.status_code == 200

def test_delete_pos():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Happy path - release reservation
    payload = {
        "session_id": "test-session-id",
        "tab_id": "test-tab-id",
        "presentation_id": 1,
        "units_to_release": 5.0
    }
    response = requests.patch(f"{BASE_URL}/pos/reserve", json=payload, headers=headers)
    log_result("test_delete_pos_happy_path", "PATCH", "/pos/reserve", response.status_code, payload, response.json())
    assert response.status_code == 200

def main():
    tests = [
        test_list_pos,
        test_reserve_pos,
        test_update_pos,
        test_delete_pos
    ]

    failures = 0
    for test in tests:
        try:
            test()
        except AssertionError:
            failures += 1

    print(f"Tests completed: {len(tests) - failures} passed, {failures} failed")
    return failures

if __name__ == "__main__":
    sys.exit(main())