import requests

response = requests.post("https://noviq-kappa.vercel.app/run", json={
    "service_id": "token_price",
    "input_data": "ethereum",
    "user_id": "0x3b002394D3202B02CE0A9bfD5c0819d6Dd353a56"
})
print(response.json())