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

def test_list_credit_notes(token):
    url = f"{BASE_URL}/credit-notes"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_list_credit_notes", "GET", "/credit-notes", response.status_code, None, response.json())
    return response

def test_create_credit_note(token):
    url = f"{BASE_URL}/credit-notes"
    payload = {
        "sale_id": 1,
        "reason": "Producto defectuoso",
        "reason_description": "El cliente devolvió el producto por estar dañado",
        "type": "refund",
        "items": [
            {
                "sale_detail_id": 1,
                "package_quantity_returned": 0,
                "loose_units_returned": 1,
                "return_to_stock": True
            }
        ]
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_create_credit_note", "POST", "/credit-notes", response.status_code, payload, response.json())
    return response

def test_get_credit_note(token, credit_note_id):
    url = f"{BASE_URL}/credit-notes/{credit_note_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_get_credit_note", "GET", f"/credit-notes/{credit_note_id}", response.status_code, None, response.json())
    return response

def test_update_credit_note(token, credit_note_id):
    url = f"{BASE_URL}/credit-notes/{credit_note_id}"
    payload = {
        "status": "approved"
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.put(url, json=payload, headers=headers)
    log_result("test_update_credit_note", "PUT", f"/credit-notes/{credit_note_id}", response.status_code, payload, response.json())
    return response

def test_delete_credit_note(token, credit_note_id):
    url = f"{BASE_URL}/credit-notes/{credit_note_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers)
    log_result("test_delete_credit_note", "DELETE", f"/credit-notes/{credit_note_id}", response.status_code, None, response.json())
    return response

def test_no_auth():
    url = f"{BASE_URL}/credit-notes"
    response = requests.get(url)
    log_result("test_no_auth", "GET", "/credit-notes", response.status_code, None, response.json())

def test_invalid_data():
    token = get_token()
    url = f"{BASE_URL}/credit-notes"
    payload = {
        # Missing required fields
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_invalid_data", "POST", "/credit-notes", response.status_code, payload, response.json())

def test_not_found():
    token = get_token()
    url = f"{BASE_URL}/credit-notes/99999999"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    log_result("test_not_found", "GET", "/credit-notes/99999999", response.status_code, None, response.json())

def test_duplicate():
    token = get_token()
    url = f"{BASE_URL}/credit-notes"
    payload = {
        "sale_id": 1,
        "customer_id": 2,
        "warehouse_id": 3,
        "status": "pending",
        "created_by": 4
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json=payload, headers=headers)
    log_result("test_duplicate", "POST", "/credit-notes", response.status_code, payload, response.json())

def main():
    token = get_token()
    test_list_credit_notes(token)

    create_response = test_create_credit_note(token)
    if create_response.status_code == 201:
        credit_note_id = create_response.json()["data"]["id"]
        try:
            test_get_credit_note(token, credit_note_id)
            test_update_credit_note(token, credit_note_id)
            test_no_auth()
            test_invalid_data()
            test_not_found()
            test_duplicate()
        finally:
            test_delete_credit_note(token, credit_note_id)
    else:
        print("Failed to create credit note for testing")

if __name__ == "__main__":
    sys.exit(main())