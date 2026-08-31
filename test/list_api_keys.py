import requests

wallet_address = "0xYourWalletAddressHere"
response = requests.get(f"https://noviq-five.vercel.app/api-keys/{wallet_address}")

print(response.json())