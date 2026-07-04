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
        "response": json.dumps(resp, ensure_ascii=False)
    }
    print(json.dumps(result, ensure_ascii=False))

def test_list_suppliers():
    url = f"{BASE_URL}/suppliers"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_suppliers", "GET", "/suppliers", response.status_code, None, response.json())
    assert response.status_code == 200

def test_create_supplier():
    url = f"{BASE_URL}/suppliers"
    headers = {"Authorization": f"Bearer {get_token()}"}
    ts = int(time.time())
    payload = {
        "name": f"API_TEST_DELETE_{ts}",
        "tax_id": f"TAX{ts}",  # unique per run to avoid conflicts
        "payment_terms": "30 días",
        "notes": "Test supplier"
    }
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_supplier", "POST", "/suppliers", response.status_code, payload, response.json())
    assert response.status_code == 201
    return response.json()["data"]

def test_get_supplier(supplier_id):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_supplier", "GET", f"/suppliers/{supplier_id}", response.status_code, None, response.json())
    assert response.status_code == 200

def test_update_supplier(supplier_id):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    payload = {
        "name": f"API_TEST_UPDATE_{int(time.time())}",
        "tax_id": "987654321",
        "payment_terms": "15 días",
        "notes": "Updated test supplier"
    }
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_supplier", "PUT", f"/suppliers/{supplier_id}", response.status_code, payload, response.json())
    assert response.status_code == 200

def test_delete_supplier(supplier_id):
    url = f"{BASE_URL}/suppliers/{supplier_id}"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.delete(url, headers=headers)
    log_result("test_delete_supplier", "DELETE", f"/suppliers/{supplier_id}", response.status_code, None, response.json())
    assert response.status_code == 200

def test_list_suppliers_no_auth():
    url = f"{BASE_URL}/suppliers"
    response = requests.get(url)
    log_result("test_list_suppliers_no_auth", "GET", "/suppliers", response.status_code, None, response.json())
    assert response.status_code in [401, 403]

def test_get_supplier_not_found():
    url = f"{BASE_URL}/suppliers/99999999"
    headers = {"Authorization": f"Bearer {get_token()}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_supplier_not_found", "GET", "/suppliers/99999999", response.status_code, None, response.json())
    assert response.status_code == 404

def test_create_duplicate_supplier():
    url = f"{BASE_URL}/suppliers"
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    ts = int(time.time())
    payload = {
        "name": f"API_TEST_DUPE_{ts}",
        "tax_id": f"DUPE{ts}",  # unique per run to avoid dirty-data conflicts
        "payment_terms": "30 días",
        "notes": "Test supplier"
    }
    # Create the first instance
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_supplier", "POST", "/suppliers", response.status_code, payload, response.json())
    assert response.status_code == 201
    dupe_supplier_id = response.json()["data"]["id"]

    # Try to create the same supplier again
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_duplicate_supplier", "POST", "/suppliers", response.status_code, payload, response.json())
    assert response.status_code == 409

    # Clean up the supplier created for this test
    requests.delete(f"{url}/{dupe_supplier_id}", headers=headers)

def main():
    failures = 0

    try:
        test_list_suppliers()
        supplier_data = test_create_supplier()
        supplier_id = supplier_data["id"]

        test_get_supplier(supplier_id)
        test_update_supplier(supplier_id)

        test_list_suppliers_no_auth()
        test_get_supplier_not_found()
        test_create_duplicate_supplier()

    except AssertionError as e:
        failures += 1
        print(f"Test failed: {e}")

    finally:
        try:
            test_delete_supplier(supplier_id)
        except Exception as e:
            print(f"Cleanup failed: {e}")

    return failures

if __name__ == "__main__":
    sys.exit(main())