import requests

wallet_address = "0xYourWalletAddressHere"
response = requests.get(f"https://noviq-five.vercel.app/transactions/{wallet_address}")

print(response.json())