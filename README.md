## Overview

Noviq is an **API service marketplace** where every API call is paid for with **USDC micropayments** settled on the [Arc Testnet](https://developers.circle.com). Users connect an EVM wallet, fund it with testnet USDC, and consume AI services — each request is automatically settled on-chain via [Circle Programmable Wallets](https://developers.circle.com/w3s/programmable-wallets-overview).

There are no accounts to create, no credit cards to enter, and no monthly invoices. You pay exactly for what you use — one request at a time.

### Highlights

| | Feature | Details |
|---|---|---|
| 🔐 | **Wallet-native auth** | EIP-191 `personal_sign` to prove wallet ownership — no passwords, no OAuth |
| 💸 | **Gasless micropayments** | USDC transfers via Circle Programmable Wallets — users never pay gas |
| 🤖 | **Pluggable services** | Add a new AI service by registering a single async function |
| 🔑 | **API key management** | Generate, list, and revoke keys from the dashboard or API |
| ⚡ | **Rate limiting** | 60 req/min per key, database-backed sliding window |
| 🧾 | **On-chain audit trail** | Every transaction is recorded with its on-chain tx hash |

---

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Connect  │────▶│  2. Get Key  │────▶│  3. Fund    │────▶│  4. Call    │
│    Wallet    │     │  (sign msg)  │     │   (USDC)     │     │   Services   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                              ┌──────────────┐
                                                              │ 5. Auto-pay  │
                                                              │ (on success) │
                                                              └──────────────┘
```

1. **Connect your wallet** — MetaMask, Rabby, or any EVM-compatible wallet
2. **Generate an API key** — sign a one-time challenge message to prove ownership
3. **Fund your wallet** — grab testnet USDC from the [Circle Faucet](https://faucet.circle.com/)
4. **Call any service** — pass your `nvq_` API key in the `Authorization` header
5. **Automatic payment** — USDC is transferred on-chain from your wallet to the seller **only if the service succeeds**. You are never charged for failed requests.

---

## Getting Started

### Prerequisites

| Requirement | Purpose |
|---|---|
| **Python 3.10+** | Backend runtime |
| **PostgreSQL** | Persistent storage (or a hosted provider like [Neon](https://neon.tech) / [Supabase](https://supabase.com)) |
| **Circle Developer Account** | Programmable Wallets & USDC transfers — [console.circle.com](https://console.circle.com) |

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/noviq.git
cd noviq

# Install Python dependencies
pip install -r requirements.txt
```

### Environment Configuration

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/noviq

# Circle (from https://console.circle.com)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=                    # 64 hex chars — see setup below

# Marketplace
SELLER_WALLET_ADDRESS=                   # Created during setup

# LLM
NVIDIA_API_KEY=your_nvidia_key

# Chain (defaults are fine for Arc Testnet)
ARC_TESTNET_RPC_URL=https://arc-testnet.drpc.org
ARC_CHAIN_ID=201980
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

### Circle Entity Secret Setup

The entity secret is a 32-byte key used to encrypt wallet operations with Circle's API.

```bash
# Step 1: Generate a cryptographically secure entity secret
python backend/scripts/generate_entity_secret.py

# Step 2: Copy the output into your .env as CIRCLE_ENTITY_SECRET=<hex>

# Step 3: Encrypt & register the secret with Circle
python backend/scripts/register_entity_secret.py
```

> ⚠️ **Important:** The recovery file generated during registration can only be downloaded **once**. Store it securely offline — never commit it to version control.

### One-Step Production Bootstrap

Alternatively, run the production setup script which handles entity secret registration and seller wallet creation in one go:

```bash
python backend/scripts/setup_production.py
```

This will:
1. Register the entity secret with Circle
2. Create the marketplace seller wallet on Arc Testnet
3. Update your `.env` with the `SELLER_WALLET_ADDRESS`

### Run the Development Server

```bash
python dev.py
```

```
Starting development server...
Frontend: http://127.0.0.1:8000/
API Docs: http://127.0.0.1:8000/docs
```

| URL | Page |
|---|---|
| `http://127.0.0.1:8000/` | Landing page |
| `http://127.0.0.1:8000/api/` | API key management dashboard |
| `http://127.0.0.1:8000/documentation.html` | Developer documentation |
| `http://127.0.0.1:8000/docs` | Interactive Swagger UI |
| `http://127.0.0.1:8000/redoc` | ReDoc API reference |

---

## API Reference

### Authentication

All protected endpoints require an API key via the `Authorization` header:

```
Authorization: Bearer nvq_your_api_key_here
```

Both `Bearer nvq_...` and plain `nvq_...` formats are accepted.

---

### Public Endpoints

#### `GET /health`

Health check — reports whether Circle API keys and seller wallet are configured.

```bash
curl https://your-app.vercel.app/health
```

```json
{
  "status": "ok",
  "circle_api_key_set": true,
  "entity_secret_set": true,
  "seller_wallet_configured": true
}
```

---

#### `GET /services`

Returns all available services with pricing.

```bash
curl https://your-app.vercel.app/services
```

```json
[
  {
    "id": "token_price",
    "name": "📈 Token Price",
    "description": "Gets the current price for a given cryptocurrency token.",
    "price_usdc": 0.001
  }
]
```

---

#### `GET /auth/nonce/{wallet_address}`

Generates a one-time nonce and challenge message for wallet signature verification.

```bash
curl https://your-app.vercel.app/auth/nonce/0xYourWalletAddress
```

```json
{
  "nonce": "a1b2c3d4e5f6...",
  "message": "Noviq: Verify wallet ownership\nNonce: a1b2c3d4e5f6...",
  "expires_in": 300
}
```

---

### Service Execution

#### `POST /run` — Direct Payment

Runs a service and automatically transfers USDC from the user's Circle wallet to the seller wallet **upon successful execution**. **Requires API key.**

```bash
curl -X POST https://your-app.vercel.app/run \
  -H "Authorization: Bearer nvq_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "token_price",
    "input_data": "bitcoin"
  }'
```

**Response:**

```json
{
  "service_id": "token_price",
  "result": "67432.51",
  "price_usdc": 0.001,
  "tx_hash": "0xabc123def456..."
}
```

---

#### `POST /run-service` — x402 Payment Flow

Two-step payment flow using the [x402 protocol](https://www.x402.org/). **Requires API key.**

**Step 1:** Call without a payment header to receive a `402 Payment Required` challenge:

```json
{
  "scheme": "x402",
  "price_usdc": 0.001,
  "price_usdc_atomic": 1000,
  "token_address": "0x3600000000000000000000000000000000000000",
  "seller_address": "0x...",
  "chain_id": 201980,
  "agent_id": "token_price",
  "description": "Run 📈 Token Price on Noviq"
}
```

**Step 2:** Re-send the request with `X-Payment-Authorization` header containing the signed EIP-3009 authorization.

---

### Wallet Management

#### `POST /wallet`

Creates or retrieves a Circle Programmable Wallet for the given user.

```bash
curl -X POST https://your-app.vercel.app/wallet \
  -H "Content-Type: application/json" \
  -d '{"user_id": "0xYourWalletAddress"}'
```

```json
{
  "wallet_id": "circle-wallet-uuid",
  "address": "0xCircleWalletAddress",
  "usdc_balance": 10.5,
  "user_id": "0xYourWalletAddress"
}
```

---

#### `GET /wallet/{user_id}` 🔒

Returns wallet details and live USDC balance. You can only view your own wallet. **Requires API key.**

---

#### `GET /transactions/{user_id}`

Returns the full transaction history for a wallet address.

```json
[
  {
    "service_id": "token_price",
    "cost": 0.001,
    "status": "verified",
    "txHash": "0xabc123...",
    "time": "2026-08-31T12:00:00+00:00"
  }
]
```

---

### API Key Management

#### `POST /api-keys`

Generate a new API key. Requires a wallet signature to prove ownership.

```json
{
  "wallet_address": "0xYourWalletAddress",
  "label": "my-bot",
  "signature": "0xSigned...",
  "nonce": "a1b2c3d4..."
}
```

**Response:**

```json
{
  "api_key": "nvq_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
  "key_prefix": "nvq_a1b2c3d4",
  "label": "my-bot",
  "created_at": "2026-08-31T12:00:00+00:00"
}
```

> ⚠️ The full API key is shown **only once**. Store it securely.

---

#### `GET /api-keys/{wallet_address}`

Lists all API keys (active and revoked) for a wallet.

---

#### `DELETE /api-keys/{key_prefix}` 🔒

Revokes an API key. Can be authenticated with either a valid API key **or** a fresh wallet signature.

---

### API Key Rules

| Rule | Detail |
|---|---|
| **Format** | Keys start with `nvq_` (52 characters total) |
| **Limit** | Max 2 active keys per wallet |
| **Rate limit** | 60 requests per minute per key |
| **Revocation** | Via dashboard, API key, or wallet signature |
| **Visibility** | Full key shown only at creation — not retrievable after |

---

### Error Responses

All errors return a consistent JSON structure:

```json
{
  "result": null,
  "error": "Human-readable error message",
  "status_code": 402
}
```

| Code | Meaning |
|---|---|
| `400` | Bad request — invalid input data or missing fields |
| `401` | Missing, invalid, or revoked API key |
| `402` | Insufficient USDC balance — fund your wallet and retry |
| `403` | Forbidden — attempting to access another wallet's resources |
| `404` | Unknown `service_id` or resource not found |
| `409` | API key limit reached (max 2 per wallet) |
| `429` | Rate limit exceeded — wait and retry |
| `502` | Upstream service error (LLM, CoinGecko, etc.) — try again later |

---

## Project Structure

```
noviq/
│
├── api/
│   └── index.py                    # Vercel serverless entry point
│
├── backend/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app — routes, middleware, error handling
│   ├── auth.py                     # API key generation, validation, EIP-191 signature verification
│   ├── config.py                   # Environment variables and constants
│   ├── database.py                 # PostgreSQL operations (psycopg2 connection pool)
│   ├── models.py                   # Pydantic request / response schemas
│   ├── payment.py                  # x402 payment challenges, Circle on-chain transfers
│   ├── services.py                 # Service registry and implementations
│   ├── wallet.py                   # Circle Programmable Wallets — create, balance, checksum
│   └── scripts/
│       ├── generate_entity_secret.py    # Generate 32-byte hex entity secret
│       ├── register_entity_secret.py    # Encrypt & register secret with Circle API
│       └── setup_production.py          # Full production bootstrap
│
├── frontend/
│   ├── landing/                    # Marketing landing page
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   ├── api/                        # API key management dashboard
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   ├── docs/                       # Developer documentation
│   │   ├── documentation.html
│   │   ├── docs.css
│   │   └── docs.js
│   └── assets/                     # Logo, favicon, hero background
│
├── test/                           # Integration test scripts
│   ├── token_price.py
│   ├── x_fetch.py
│   └── llama-3.1.py
│
├── dev.py                          # Local development server (uvicorn + static routing)
├── vercel.json                     # Vercel build config & route rewrites
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variable template
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Python 3.10+, FastAPI, Uvicorn |
| **Data models** | Pydantic v2 |
| **Database** | PostgreSQL via psycopg2 (connection pool) |
| **Blockchain** | Arc Testnet (Chain ID 201980) |
| **Payments** | Circle Programmable Wallets, USDC ERC-20 transfers |
| **Cryptography** | PyCryptodome (RSA-OAEP encryption), eth-account (EIP-191 signatures) |
| **HTTP client** | httpx (async) |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Typography** | Inter, JetBrains Mono, Playfair Display (Google Fonts) |

---

## Database Schema

All tables are auto-created on first startup via `database.init_db()`.

### `wallets`

| Column | Type | Description |
|---|---|---|
| `user_id` | `TEXT` (PK) | EVM wallet address (EIP-55 checksummed) |
| `wallet_id` | `TEXT` | Circle Programmable Wallet ID |

### `transactions`

| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL` (PK) | Auto-incrementing ID |
| `user_id` | `TEXT` | Wallet address of the caller |
| `service_id` | `TEXT` | Service that was executed |
| `service_name` | `TEXT` | Human-readable service name |
| `cost` | `REAL` | Amount charged in USDC |
| `status` | `TEXT` | Transaction status (`verified`) |
| `tx_hash` | `TEXT` | On-chain transaction hash |
| `created_at` | `TEXT` | ISO 8601 timestamp |

### `api_keys`

| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL` (PK) | Auto-incrementing ID |
| `key_hash` | `TEXT` (UNIQUE) | SHA-256 hash of the full API key |
| `key_prefix` | `TEXT` | First 12 chars (e.g. `nvq_a1b2c3d4`) for display |
| `wallet_address` | `TEXT` | Owning wallet address |
| `label` | `TEXT` | User-defined label |
| `created_at` | `TEXT` | ISO 8601 timestamp |
| `last_used_at` | `TEXT` | Last request timestamp |
| `is_revoked` | `BOOLEAN` | Revocation flag |

### `api_rate_limits`

| Column | Type | Description |
|---|---|---|
| `key_hash` | `TEXT` (PK) | API key hash |
| `window_start` | `TIMESTAMP` (PK) | Start of the rate limit window |
| `request_count` | `INTEGER` | Requests made in this window |

### `auth_nonces`

| Column | Type | Description |
|---|---|---|
| `id` | `SERIAL` (PK) | Auto-incrementing ID |
| `wallet_address` | `TEXT` | Wallet this nonce was issued for |
| `nonce` | `TEXT` (UNIQUE) | Single-use nonce value |
| `created_at` | `TEXT` | ISO 8601 timestamp |
| `consumed` | `BOOLEAN` | Whether the nonce has been used |

Nonces expire after **5 minutes** and are cleaned up automatically after **10 minutes**.

---

#### Route Architecture

| Pattern | Destination |
|---|---|
| `/auth/*`, `/run*`, `/wallet*`, `/services`, `/health` | Python serverless function (`api/index.py`) |
| `/api-keys*`, `/transactions/*`, `/docs`, `/redoc` | Python serverless function (`api/index.py`) |
| `/`, `/styles.css`, `/app.js` | Static (`frontend/landing/`) |
| `/api/`, `/api/app.js`, `/api/styles.css` | Static (`frontend/api/`) |
| `/documentation.html`, `/docs.css`, `/docs.js` | Static (`frontend/docs/`) |
| `/assets/*` | Static (`frontend/assets/`) |

---

## Testing

Integration test scripts in the `test/` directory verify each service against a running instance:

```bash
# Start the dev server
python dev.py

# In a separate terminal — update the API key in each script first
python test/token_price.py          # → prints current BTC price
python test/x_fetch.py              # → prints recent tweets from @elonmusk
python test/llama-3.1.py            # → prints LLM response to "What is BTC?"
```

> **Note:** Replace the `Authorization` value in each test script with a valid API key from your instance.

---

## FAQ

<details>
<summary><strong>Do I need to pay gas fees?</strong></summary>
<br/>
No. Noviq uses Circle Programmable Wallets — all USDC transfers are gasless for users. Circle handles the gas on the Arc Testnet.
</details>

<details>
<summary><strong>What blockchain is this on?</strong></summary>
<br/>
Arc Testnet (Chain ID <code>201980</code>). All payments use testnet USDC, so no real money is involved during beta.
</details>

<details>
<summary><strong>Where do I get testnet USDC?</strong></summary>
<br/>
Use the <a href="https://faucet.circle.com/">Circle Faucet</a>. Select <strong>Arc Testnet</strong> and enter your wallet address.
</details>

<details>
<summary><strong>Can I use Noviq from a backend / bot / script?</strong></summary>
<br/>
Yes. Generate an API key once via the dashboard (requires a one-time wallet signature), then use it in any HTTP client — no browser or wallet connection needed after that.
</details>

<details>
<summary><strong>What happens if my balance is too low?</strong></summary>
<br/>
You'll receive a <code>402</code> error with your current balance and the required amount. Fund your wallet via the faucet and retry.
</details>

<details>
<summary><strong>How do I add a new service?</strong></summary>
<br/>
Define an <code>async</code> function that takes a string input and returns a string result, then register it in the <code>SERVICE_REGISTRY</code> dictionary in <a href="backend/services.py"><code>backend/services.py</code></a> with a price and description.
</details>

---

## License

This project is currently unlicensed. Contact the maintainers for usage terms.
