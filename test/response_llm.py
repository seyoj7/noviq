import requests

response = requests.post("http://localhost:8000/run", json={
    "service_id": "llama-3.1-8b-instruct",
    "input_data": "What is the capital of France?",
    "user_id": "0xdb819f7b4f275babbd19bcede38829d69143f660"
})
print(response.json()["result"])