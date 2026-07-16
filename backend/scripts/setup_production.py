import asyncio
import re
import sys
from pathlib import Path

# Add backend to path so we can import things
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.scripts import register_entity_secret
from backend.wallet import create_wallet

async def main():
    print("=== Production Setup ===")
    
    # 1. Register entity secret
    print("\n--- Step 1: Register Entity Secret ---")
    try:
        import httpx
        register_entity_secret.main()
    except Exception as e:
        if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 409:
            print("Entity secret is already registered. Continuing...")
        else:
            raise e

    # 2. Create Seller Wallet
    print("\n--- Step 2: Create Seller Wallet ---")
    print("Generating marketplace seller wallet...")
    seller_wallet = await create_wallet("marketplace-seller")
    
    seller_address = seller_wallet.address
    print(f"Seller Wallet Created: {seller_address}")

    # 3. Update .env
    print("\n--- Step 3: Update .env ---")
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        content = env_path.read_text()
        
        # Replace SELLER_WALLET_ADDRESS=... with the new one
        new_content, count = re.subn(
            r"^SELLER_WALLET_ADDRESS=.*$",
            f"SELLER_WALLET_ADDRESS={seller_address}",
            content,
            flags=re.MULTILINE
        )
        
        if count > 0:
            env_path.write_text(new_content)
            print(f"Updated .env with SELLER_WALLET_ADDRESS={seller_address}")
        else:
            # If not found, append it
            with open(env_path, "a") as f:
                f.write(f"\nSELLER_WALLET_ADDRESS={seller_address}\n")
            print(f"Appended SELLER_WALLET_ADDRESS={seller_address} to .env")
    else:
        print("Could not find .env file to update!")
        
    print("\n=== Production Setup Complete ===")

if __name__ == "__main__":
    asyncio.run(main())