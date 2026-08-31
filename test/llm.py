import requests

response = requests.post("https://noviq-five.vercel.app/run",
    headers={"Authorization": "nvq_full_api_key_here"},
    json={
        "service_id": "nemotron-3-super",
        "input_data": "What is the Blockchain"
})

print(response.json())