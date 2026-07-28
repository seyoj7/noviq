import requests

response = requests.post("http://localhost:8000/run", json={
    "service_id": "non_existent_service",
    "input_data": "test",
    "user_id": "0xdb819f7b4f275babbd19bcede38829d69143f660"
})
print("Invalid Service Response Code:", response.status_code)
print("Error Detail:", response.json())
