import secrets


# Generate 32 cryptographically secure random bytes, hex-encoded
# This matches Circle's expected format: 64 hex characters = 32 bytes
def main() -> None:
    entity_secret = secrets.token_hex(32)

    print()
    print("=" * 64)
    print("  CIRCLE ENTITY SECRET (32 bytes, hex-encoded)")
    print("=" * 64)
    print()
    print(entity_secret)
    print()
    print("=" * 64)
    print()
    print("NEXT STEPS:")
    print("  1. Copy the value above.")
    print("  2. Open your .env file.")
    print("  3. Add this line:")
    print(f"     CIRCLE_ENTITY_SECRET={entity_secret}")
    print("  4. Save the file.")
    print("  5. Run register_entity_secret.py to register it with Circle.")
    print()
    print("WARNING: Do NOT run this script again after registering.")
    print("         A new run generates a DIFFERENT secret that won't")
    print("         match your registered ciphertext.")
    print()


if __name__ == "__main__":
    main()