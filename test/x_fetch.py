import requests

response = requests.post("https://noviq-five.vercel.app/run",
    headers={"Authorization": "nvq_full_api_key_here"},
    json={
        "service_id": "twitter_fetch",
        "input_data": "elonmusk"
})
print(response.json()["result"])