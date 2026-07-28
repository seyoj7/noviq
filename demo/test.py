import requests

response = requests.post("http://localhost:8000/run", json={
    "service_id": "token_price",
    "input_data": "ethereum",
    "user_id": "0xdb819f7b4f275babbd19bcede38829d69143f660"
})
result = response.json()["result"]
print(result.split("is ")[1].rstrip("."))