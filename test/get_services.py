import requests

response = requests.get("https://noviq-five.vercel.app/services")

print(response.json())