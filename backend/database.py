import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime, timezone
import logging

from backend.config import POSTGRES_URL

logger = logging.getLogger(__name__)

# ── Connection Pool ─────────────────────────────────────────────────
# Lazily initialised; lives for the lifetime of the warm serverless
# function instance.  SimpleConnectionPool is fine because Vercel
# invocations are single-threaded.

_pool: psycopg2.pool.SimpleConnectionPool | None = None


def _get_pool() -> psycopg2.pool.SimpleConnectionPool | None:
    global _pool
    if not POSTGRES_URL:
        return None
    if _pool is None or _pool.closed:
        try:
            _pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=5,
                dsn=POSTGRES_URL,
            )
            logger.info("Database connection pool created.")
        except Exception as e:
            logger.error("Failed to create connection pool: %s", e)
            return None
    return _pool


@contextmanager
def _borrow():
    pool = _get_pool()
    if pool is None:
        yield None
        return
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


# ── Schema bootstrap (runs at most once per process) ────────────────

_db_initialized = False


def init_db():
    global _db_initialized
    if _db_initialized:
        return
    if not POSTGRES_URL:
        logger.warning("POSTGRES_URL not set. Database not initialized.")
        return

    try:
        with _borrow() as conn:
            if conn is None:
                return
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
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS api_rate_limits (
                        key_hash TEXT NOT NULL,
                        window_start TIMESTAMP NOT NULL,
                        request_count INTEGER NOT NULL,
                        PRIMARY KEY (key_hash, window_start)
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS auth_nonces (
                        id SERIAL PRIMARY KEY,
                        wallet_address TEXT NOT NULL,
                        nonce TEXT NOT NULL UNIQUE,
                        created_at TEXT NOT NULL,
                        consumed BOOLEAN NOT NULL DEFAULT FALSE
                    )
                """)
            conn.commit()
        _db_initialized = True
        logger.info("Database schema initialised.")
    except Exception as e:
        logger.error("Failed to initialize database: %s", e)

# Wallet Operations
def get_wallet(user_id: str) -> str | None:
    with _borrow() as conn:
        if conn is None:
            return None
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT wallet_id FROM wallets WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            return row["wallet_id"] if row else None

def save_wallet(user_id: str, wallet_id: str):
    with _borrow() as conn:
        if conn is None:
            return
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO wallets (user_id, wallet_id) VALUES (%s, %s)
                ON CONFLICT (user_id) DO UPDATE SET wallet_id = EXCLUDED.wallet_id
                """,
                (user_id, wallet_id)
            )
        conn.commit()

# Transaction Operations
def save_transaction(user_id: str, service_id: str, service_name: str, cost: float, status: str, tx_hash: str):
    with _borrow() as conn:
        if conn is None:
            return
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
        conn.commit()

def get_transactions(user_id: str) -> list[dict]:
    with _borrow() as conn:
        if conn is None:
            return []
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM transactions WHERE user_id = %s ORDER BY id DESC", (user_id,))
            rows = cur.fetchall()

            # Format response keys
            return [
                {
                    "service_id": row["service_id"],
                    "cost": row["cost"],
                    "status": row["status"],
                    "txHash": row["tx_hash"],
                    "time": row["created_at"],
                }
                for row in rows
            ]


# ── API Rate Limiting ───────────────────────────────────────────────

def check_rate_limit(key_hash: str, limit: int = 60, window_seconds: int = 60) -> bool:
    with _borrow() as conn:
        if conn is None:
            return True # Fail open if DB is down
        with conn.cursor() as cur:
            # Delete windows older than 1 hour (lightweight cleanup)
            cur.execute(
                "DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 hour'"
            )
            
            # Increment request count for the current window
            # We truncate current time to the window size (e.g., current minute)
            cur.execute(
                f"""
                INSERT INTO api_rate_limits (key_hash, window_start, request_count)
                VALUES (%s, date_trunc('minute', now()), 1)
                ON CONFLICT (key_hash, window_start) 
                DO UPDATE SET request_count = api_rate_limits.request_count + 1
                RETURNING request_count
                """,
                (key_hash,)
            )
            count = cur.fetchone()[0]
            conn.commit()
            
            return count <= limit


# API Key Operations
def save_api_key(key_hash: str, key_prefix: str, wallet_address: str, label: str = ""):
    with _borrow() as conn:
        if conn is None:
            return
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
        conn.commit()


def get_api_key(key_hash: str) -> dict | None:
    with _borrow() as conn:
        if conn is None:
            return None
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM api_keys WHERE key_hash = %s AND is_revoked = FALSE",
                (key_hash,)
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_api_keys_for_wallet(wallet_address: str) -> list[dict]:
    with _borrow() as conn:
        if conn is None:
            return []
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT key_prefix, label, created_at, last_used_at, is_revoked "
                "FROM api_keys WHERE wallet_address = %s ORDER BY id DESC",
                (wallet_address,)
            )
            return [dict(row) for row in cur.fetchall()]


def revoke_api_key(key_prefix: str, wallet_address: str) -> bool:
    with _borrow() as conn:
        if conn is None:
            return False
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE api_keys SET is_revoked = TRUE "
                "WHERE key_prefix = %s AND wallet_address = %s AND is_revoked = FALSE",
                (key_prefix, wallet_address)
            )
            conn.commit()
            return cur.rowcount > 0


def update_api_key_last_used(key_hash: str):
    with _borrow() as conn:
        if conn is None:
            return
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE api_keys SET last_used_at = %s WHERE key_hash = %s",
                (datetime.now(timezone.utc).isoformat(), key_hash)
            )
        conn.commit()


# Auth Nonce Operations
def save_nonce(wallet_address: str, nonce: str):
    # Lazily clean up expired nonces first
    cleanup_expired_nonces()
    with _borrow() as conn:
        if conn is None:
            return
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO auth_nonces (wallet_address, nonce, created_at)
                VALUES (%s, %s, %s)
            """, (
                wallet_address,
                nonce,
                datetime.now(timezone.utc).isoformat()
            ))
        conn.commit()


def get_nonce(nonce: str, wallet_address: str) -> dict | None:
    with _borrow() as conn:
        if conn is None:
            return None
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM auth_nonces "
                "WHERE nonce = %s AND wallet_address = %s AND consumed = FALSE",
                (nonce, wallet_address)
            )
            row = cur.fetchone()
            if row is None:
                return None
            # Check expiry (5 minutes)
            created = datetime.fromisoformat(row["created_at"])
            age = (datetime.now(timezone.utc) - created).total_seconds()
            if age > 300:
                return None
            return dict(row)


def consume_nonce(nonce: str):
    with _borrow() as conn:
        if conn is None:
            return
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE auth_nonces SET consumed = TRUE WHERE nonce = %s",
                (nonce,)
            )
        conn.commit()


def cleanup_expired_nonces():
    from datetime import timedelta
    with _borrow() as conn:
        if conn is None:
            return
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM auth_nonces WHERE created_at < %s",
                (cutoff,)
            )
        conn.commit()

