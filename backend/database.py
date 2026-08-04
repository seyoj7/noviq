import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
import logging

from backend.config import POSTGRES_URL

logger = logging.getLogger(__name__)

def get_db_conn():
    if not POSTGRES_URL:
        # If no DB URL is configured, we can't connect.
        return None
    return psycopg2.connect(POSTGRES_URL)

def init_db():
    if not POSTGRES_URL:
        logger.warning("POSTGRES_URL not set. Database not initialized.")
        return

    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS wallets (
                        user_id TEXT PRIMARY KEY,
                        wallet_id TEXT NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS transactions (
                        id SERIAL PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        service_id TEXT NOT NULL,
                        service_name TEXT NOT NULL,
                        cost REAL NOT NULL,
                        status TEXT NOT NULL,
                        tx_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS api_keys (
                        id SERIAL PRIMARY KEY,
                        key_hash TEXT NOT NULL UNIQUE,
                        key_prefix TEXT NOT NULL,
                        wallet_address TEXT NOT NULL,
                        label TEXT NOT NULL DEFAULT '',
                        created_at TEXT NOT NULL,
                        last_used_at TEXT,
                        is_revoked BOOLEAN NOT NULL DEFAULT FALSE
                    )
                """)
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

# Wallet Operations
def get_wallet(user_id: str) -> str | None:
    conn = get_db_conn()
    if not conn: return None
    
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT wallet_id FROM wallets WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
                return row["wallet_id"] if row else None
    finally:
        conn.close()

def save_wallet(user_id: str, wallet_id: str):
    conn = get_db_conn()
    if not conn: return
    
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO wallets (user_id, wallet_id) VALUES (%s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET wallet_id = EXCLUDED.wallet_id
                    """, 
                    (user_id, wallet_id)
                )
    finally:
        conn.close()

# Transaction Operations
def save_transaction(user_id: str, service_id: str, service_name: str, cost: float, status: str, tx_hash: str):
    conn = get_db_conn()
    if not conn: return
    
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO transactions (user_id, service_id, service_name, cost, status, tx_hash, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id, 
                    service_id, 
                    service_name, 
                    cost, 
                    status, 
                    tx_hash, 
                    datetime.now(timezone.utc).isoformat()
                ))
    finally:
        conn.close()

def get_transactions(user_id: str) -> list[dict]:
    conn = get_db_conn()
    if not conn: return []
    
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM transactions WHERE user_id = %s ORDER BY id DESC", (user_id,))
                rows = cur.fetchall()
                
                # Format response keys to match what frontend app.js expects
                return [
                    {
                        "agent": row["service_name"],
                        "agentId": row["service_id"],
                        "cost": row["cost"],
                        "status": row["status"],
                        "txHash": row["tx_hash"],
                        "time": row["created_at"],
                    }
                    for row in rows
                ]
    finally:
        conn.close()


# API Key Operations
def save_api_key(key_hash: str, key_prefix: str, wallet_address: str, label: str = ""):
    conn = get_db_conn()
    if not conn: return

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO api_keys (key_hash, key_prefix, wallet_address, label, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    key_hash,
                    key_prefix,
                    wallet_address,
                    label,
                    datetime.now(timezone.utc).isoformat()
                ))
    finally:
        conn.close()


def get_api_key(key_hash: str) -> dict | None:
    """Look up an API key by its hash. Returns None if not found or revoked."""
    conn = get_db_conn()
    if not conn: return None

    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM api_keys WHERE key_hash = %s AND is_revoked = FALSE",
                    (key_hash,)
                )
                row = cur.fetchone()
                return dict(row) if row else None
    finally:
        conn.close()


def get_api_keys_for_wallet(wallet_address: str) -> list[dict]:
    """Return all API keys (active and revoked) for a given wallet address."""
    conn = get_db_conn()
    if not conn: return []

    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT key_prefix, label, created_at, last_used_at, is_revoked "
                    "FROM api_keys WHERE wallet_address = %s ORDER BY id DESC",
                    (wallet_address,)
                )
                return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def revoke_api_key(key_prefix: str, wallet_address: str) -> bool:
    """Revoke a key by prefix+wallet. Returns True if a key was actually revoked."""
    conn = get_db_conn()
    if not conn: return False

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE api_keys SET is_revoked = TRUE "
                    "WHERE key_prefix = %s AND wallet_address = %s AND is_revoked = FALSE",
                    (key_prefix, wallet_address)
                )
                return cur.rowcount > 0
    finally:
        conn.close()


def update_api_key_last_used(key_hash: str):
    conn = get_db_conn()
    if not conn: return

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE api_keys SET last_used_at = %s WHERE key_hash = %s",
                    (datetime.now(timezone.utc).isoformat(), key_hash)
                )
    finally:
        conn.close()
