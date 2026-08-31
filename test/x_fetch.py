import requests

response = requests.post("https://noviq-five.vercel.app/run",
    headers={"Authorization": "nvq_ca8975e3a95afb48587516dfa5d512563086a9a5d355be24"},
    json={
        "service_id": "twitter_fetch",
        "input_data": "elonmusk"
})
print(response.json()["result"])