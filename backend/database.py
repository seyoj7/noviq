import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "noviq.db"

def get_db() -> sqlite3.Connection:
    """Returns a SQLite connection."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes database tables."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS wallets (
                user_id TEXT PRIMARY KEY,
                wallet_id TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                service_id TEXT NOT NULL,
                service_name TEXT NOT NULL,
                cost REAL NOT NULL,
                status TEXT NOT NULL,
                tx_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

# --- Wallet Operations ---

def get_wallet(user_id: str) -> str | None:
    """Returns the wallet_id for a given user_id, or None."""
    with get_db() as conn:
        row = conn.execute("SELECT wallet_id FROM wallets WHERE user_id = ?", (user_id,)).fetchone()
        return row["wallet_id"] if row else None

def save_wallet(user_id: str, wallet_id: str):
    """Saves or updates a user's wallet_id."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO wallets (user_id, wallet_id) VALUES (?, ?)", 
            (user_id, wallet_id)
        )


# --- Transaction Operations ---

def save_transaction(user_id: str, service_id: str, service_name: str, cost: float, status: str, tx_hash: str):
    """Logs a completed transaction."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO transactions (user_id, service_id, service_name, cost, status, tx_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, 
            service_id, 
            service_name, 
            cost, 
            status, 
            tx_hash, 
            datetime.now(timezone.utc).isoformat()
        ))

def get_transactions(user_id: str) -> list[dict]:
    """Returns a user's transaction history formatted for the frontend."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", (user_id,)).fetchall()
        
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
