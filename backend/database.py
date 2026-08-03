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
