import requests

wallet_address = "0xYourWalletAddressHere"  # EVM wallet Address
response = requests.get(f"https://noviq-five.vercel.app/auth/nonce/{wallet_address}")

print(response.json())
