import requests

response = requests.post("https://noviq-five.vercel.app/api-keys",
    json={
        "wallet_address": "0xYourWalletAddressHere",    # EVM wallet Address
        "label": "test-key",
        "signature": "0xYourSignatureHere"
})

print(response.json())