import requests

response = requests.post("https://noviq-kappa.vercel.app/run", json={
    "service_id": "twitter_fetch",
    "input_data": "elonmusk",
    "user_id": "0xdb819f7b4f275babbd19bcede38829d69143f660"
})
print(response.json()["result"])