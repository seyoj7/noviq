import requests

response = requests.post("http://127.0.0.1:8000/run",
    headers={"Authorization": "nvq_d730c9037a729f68b27cc3cc5aa26b8d57c96f40b95dd641"},
    json={
        "service_id": "llama-3.1-8b-instruct",
        "input_data": "What is BTC?"
})
print(response.json()["result"])