import requests

user_id = "0xdb819f7b4f275babbd19bcede38829d69143f660"
response = requests.get(f"http://localhost:8000/wallet/{user_id}")
print(response.json())
