import requests

response = requests.post("http://127.0.0.1:8000/run",
    headers={"Authorization": "nvq_ca8975e3a95afb48587516dfa5d512563086a9a5d355be24"},
    json={
        "service_id": "nemotron-3-super",
        "input_data": "What is BTC?"
})
print(response.json()["result"])