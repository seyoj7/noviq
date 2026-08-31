import base64
import codecs
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from Crypto.Cipher import PKCS1_OAEP
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from dotenv import load_dotenv


# Configuration
CIRCLE_API_BASE = "https://api.circle.com/v1/w3s"

# Recovery file is saved OUTSIDE the repo root to avoid accidental commits
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
RECOVERY_DIR = REPO_ROOT.parent / "circle-secrets"


def _load_env() -> tuple[str, str]:
    # Try multiple .env locations: repo root, then cwd
    for candidate in [REPO_ROOT / ".env", Path.cwd() / ".env"]:
        if candidate.exists():
            load_dotenv(candidate)
            break

    api_key = os.getenv("CIRCLE_API_KEY")
    entity_secret = os.getenv("CIRCLE_ENTITY_SECRET")

    if not api_key:
        print("ERROR: CIRCLE_API_KEY is not set in .env")
        sys.exit(1)
    if not entity_secret:
        print("ERROR: CIRCLE_ENTITY_SECRET is not set in .env")
        print("       Run generate_entity_secret.py first and paste the")
        print("       value into .env as CIRCLE_ENTITY_SECRET=<hex>")
        sys.exit(1)

    # Validate: must be exactly 64 hex characters (32 bytes)
    if len(entity_secret) != 64:
        print(f"ERROR: CIRCLE_ENTITY_SECRET must be 64 hex chars, got {len(entity_secret)}")
        sys.exit(1)
    try:
        codecs.decode(entity_secret, "hex")
    except ValueError:
        print("ERROR: CIRCLE_ENTITY_SECRET contains non-hex characters")
        sys.exit(1)

    return api_key, entity_secret


def _fetch_entity_public_key(client: httpx.Client, api_key: str) -> str:
    resp = client.get(
        f"{CIRCLE_API_BASE}/config/entity/publicKey",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    public_key_pem = data["data"]["publicKey"]
    return public_key_pem


def _encrypt_entity_secret(entity_secret_hex: str, public_key_pem: str) -> str:
    entity_secret_bytes = codecs.decode(entity_secret_hex, "hex")
    rsa_key = RSA.import_key(public_key_pem)
    cipher = PKCS1_OAEP.new(rsa_key, hashAlgo=SHA256, mgfunc=lambda x, y: PKCS1_OAEP.MGF1(x, y, SHA256))
    encrypted = cipher.encrypt(entity_secret_bytes)
    return base64.b64encode(encrypted).decode("utf-8")


def _register_ciphertext(
    client: httpx.Client, api_key: str, ciphertext: str
) -> dict:
    resp = client.post(
        f"{CIRCLE_API_BASE}/config/entity/entitySecret",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={"entitySecretCiphertext": ciphertext},
    )
    resp.raise_for_status()
    return resp.json()


def _save_recovery_file(response_data: dict) -> Path:
    RECOVERY_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"recovery_file_{timestamp}.dat"
    filepath = RECOVERY_DIR / filename

    # The recovery file content may be in response_data["data"]["recoveryFile"]
    # or the entire data section may be the recovery payload
    recovery_content = response_data.get("data", response_data)
    filepath.write_text(json.dumps(recovery_content, indent=2), encoding="utf-8")

    return filepath


def main() -> None:
    api_key, entity_secret = _load_env()

    print()
    print("Registering entity secret with Circle...")
    print()

    with httpx.Client(timeout=30.0) as client:
        # Step 1: Fetch entity public key
        print("[1/3] Fetching entity public key...")
        public_key_pem = _fetch_entity_public_key(client, api_key)
        print("      Public key retrieved.")

        # Step 2: Encrypt entity secret
        print("[2/3] Encrypting entity secret...")
        ciphertext = _encrypt_entity_secret(entity_secret, public_key_pem)
        print("      Encryption complete.")

        # Step 3: Register with Circle
        print("[3/3] Registering ciphertext with Circle...")
        response_data = _register_ciphertext(client, api_key, ciphertext)
        print("      Registration successful!")

    # Step 4: Save recovery file
    recovery_path = _save_recovery_file(response_data)

    print()
    print("=" * 64)
    print("  REGISTRATION COMPLETE")
    print("=" * 64)
    print()
    print(f"  Recovery file saved to:")
    print(f"    {recovery_path}")
    print()
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║  WARNING: This recovery file can ONLY be             ║")
    print("  ║  downloaded ONCE. It CANNOT be regenerated           ║")
    print("  ║  without rotating your entity secret.                ║")
    print("  ║                                                      ║")
    print("  ║  Store it securely (e.g., encrypted USB, password    ║")
    print("  ║  manager, or offline backup). Do NOT commit it to    ║")
    print("  ║  version control.                                    ║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print()


if __name__ == "__main__":
    main()