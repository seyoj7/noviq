import requests

key_prefix = "nvq_prefix_here"
api_key = "nvq_full_api_key_here"

response = requests.delete(
    f"https://noviq-five.vercel.app/api-keys/{key_prefix}",
    headers={"Authorization": api_key},
    json={}
)

# Note: You can also use wallet signature in the body instead of Authorization header:
# json={"signature": "0x...", "nonce": "..."}

print(response.json())
