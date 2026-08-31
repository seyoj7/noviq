import requests

user_id = "user_id_here"
api_key = "nvq_full_api_key_here"

response = requests.get(
    f"https://noviq-five.vercel.app/wallet/{user_id}",
    headers={"Authorization": api_key}
)

print(response.json())