# Noviq — AI Services Marketplace

Noviq is a pay-per-request **AI service marketplace** where every API call is settled using **USDC micropayments** on the [Arc Testnet](https://developers.circle.com). Users connect an EVM wallet, generate an API key via an EIP-191 signature challenge, and consume AI & data services — each successful request is automatically settled on-chain via [Circle Programmable Wallets](https://developers.circle.com/w3s/programmable-wallets-overview).

There are no subscriptions, no credit cards, and no monthly commitments. You pay only for what you use — one request at a time.

---

### Highlights

| | Feature | Details |
|---|---|---|
| 🔐 | **Wallet-Native Auth** | EIP-191 `personal_sign` signature challenges to prove wallet ownership — zero passwords |
| 💸 | **Gasless Micropayments** | Direct USDC settlements via Circle Programmable Wallets — users never pay native gas |
| ⚡ | **Full-Stack Architecture** | Modern Next.js 16 (App Router) frontend with a high-performance FastAPI backend |
| 🧪 | **Interactive Playground** | Built-in web playground to test APIs directly from the browser |
| 🤖 | **Pluggable Services** | Add new AI models or data scrapers by registering an async function |
| 🔑 | **API Key Management** | Create, view prefix, and revoke keys with a max 2 active keys per wallet rule |
| ⏱️ | **Rate Limiting** | 60 requests/minute per key enforced via database sliding window |
| 🧾 | **On-Chain Audit Trail** | Every successful request records its on-chain transaction hash and request lifecycle |

---

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Connect  │────▶│  2. Get Key  │────▶│  3. Fund    │────▶│  4. Call     │
│    Wallet    │     │  (sign msg)  │     │   (USDC)     │     │   Services   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                              ┌──────────────┐
                                                              │ 5. Auto-pay  │
                                                              │ (on success) │
                                                              └──────────────┘
```

1. **Connect your wallet** — Connect MetaMask, Rabby, or any EVM-compatible wallet on Arc Testnet.
2. **Generate an API key** — Sign a one-time cryptographic challenge message (`personal_sign`) to prove ownership.
3. **Fund your wallet** — Claim testnet USDC from the [Circle Faucet](https://faucet.circle.com/).
4. **Call any service** — Pass your `nvq_` API key in the `Authorization` header via HTTP or the web playground.
5. **Automatic settlement** — USDC is transferred on-chain to the marketplace seller **only if the service succeeds**. Failed calls are never charged.

---

## Registered Services

| Service ID | Name | Cost (USDC) | Description | Input Format |
|---|---|---|---|---|
| `token_price` | 📈 Token Price | **$0.001** | Live cryptocurrency price lookup via CoinGecko | Token symbol or ID (e.g. `bitcoin`, `ethereum`) |
| `twitter_fetch` | 🐦 Twitter Fetch | **$0.05** | Recent public tweets scraper for any Twitter profile | Twitter handle (e.g. `elonmusk` or `@elonmusk`) |
| `nemotron-3-super` | 🧠 nemotron-3 | **$0.10** | NVIDIA Nemotron reasoning & chat model | Prompt string (e.g. `Explain zero knowledge proofs in simple terms`) |

---

## Getting Started

### Prerequisites

| Requirement | Version / Purpose |
|---|---|
| **Node.js** | `v18.0.0+` (v20+ recommended) & `npm` for the Next.js frontend |
| **Python** | `3.10+` for the FastAPI backend |
| **PostgreSQL** | Database storage (local PostgreSQL or hosted on [Neon](https://neon.tech) / [Supabase](https://supabase.com)) |
| **Circle Developer Account** | For Programmable Wallets & USDC transfers — [console.circle.com](https://console.circle.com) |
| **NVIDIA API Key** | Optional, required for the `nemotron-3-super` LLM service — [build.nvidia.com](https://build.nvidia.com) |

---

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/noviq.git
cd noviq

# Install Node.js frontend dependencies
npm install

# Install Python backend dependencies
pip install -r requirements.txt
```

---

### Environment Configuration

Create your `.env` file from the provided example template:

```bash
cp .env.example .env
```

Open `.env` and fill in the required configuration:

```env
# Database (PostgreSQL / Neon / Supabase)
DATABASE_URL=postgresql://user:password@host:5432/noviq

# Circle Developer Credentials (from https://console.circle.com)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=                    # 64 hex chars (32 bytes) — see setup below

# Arc Testnet Configuration
ARC_TESTNET_RPC_URL=https://arc-testnet.drpc.org
ARC_CHAIN_ID=201980
USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Marketplace Seller Wallet (receives USDC payments)
SELLER_WALLET_ADDRESS=                   # Automatically set via setup_production.py

# Optional: x402 Facilitator URL
X402_FACILITATOR_URL=https://x402-facilitator.cdp.coinbase.com

# LLM Provider Key (for nemotron-3-super service)
NVIDIA_API_KEY=your_nvidia_api_key
```

---

### Circle Entity Secret Setup

Circle Programmable Wallets require a 32-byte entity secret to encrypt developer-controlled wallet operations:

```bash
# Step 1: Generate a cryptographically secure 32-byte hex secret
python backend/scripts/generate_entity_secret.py

# Step 2: Copy the generated hex string into your .env file as:
# CIRCLE_ENTITY_SECRET=<64-hex-characters>

# Step 3: Register the secret with Circle Developer Console
python backend/scripts/register_entity_secret.py
```

> ⚠️ **Important:** The recovery file downloaded during registration is issued **only once**. Save it securely offline — never commit it to git.

---

### Automated Production Bootstrap

Alternatively, you can initialize Circle credentials and provision the marketplace seller wallet in a single step:

```bash
python backend/scripts/setup_production.py
```

This script:
1. Registers the `CIRCLE_ENTITY_SECRET` with Circle.
2. Creates the seller wallet on Arc Testnet via Circle Developer-Controlled Wallets.
3. Automatically writes `SELLER_WALLET_ADDRESS` into your `.env`.

---

### Running the Application Locally

Start both the **Next.js frontend** and the **FastAPI backend** simultaneously with:

```bash
npm run dev
```

This uses `concurrently` to run:
- **Next.js frontend**: `http://localhost:3000`
- **FastAPI backend**: `http://127.0.0.1:8000` (API requests are automatically proxied from port 3000 via `next.config.ts`)

You can also run them independently in separate terminals:

```bash
# Terminal 1: Run frontend only
npm run dev:frontend

# Terminal 2: Run backend only
npm run dev:backend
```

#### Local Endpoints & Pages

| URL | Component | Description |
|---|---|---|
| `http://localhost:3000/` | **Landing Page** | Marketing page, live architecture overview, and feature showcase |
| `http://localhost:3000/api-keys` | **API Key Dashboard** | Connect wallet, sign challenge, generate, and revoke keys |
| `http://localhost:3000/playground` | **Interactive Playground** | Test all services with custom input and view responses in real-time |
| `http://localhost:3000/docs` | **Developer Docs** | In-app documentation with code snippets and guides |
| `http://127.0.0.1:8000/docs` | **Swagger UI** | FastAPI interactive OpenAPI documentation |
| `http://127.0.0.1:8000/redoc` | **ReDoc** | Standalone OpenAPI endpoint reference |

---

## Testing & Quickstart

### 1. Web Playground

The fastest way to test Noviq is through the interactive UI at **`http://localhost:3000/playground`**:
1. Connect your EVM wallet.
2. Generate an API key from `/api-keys` (if you haven't already).
3. Select a service (`token_price`, `twitter_fetch`, or `nemotron-3-super`), enter your prompt or input, and click **Run Service**.

---

### 2. cURL Examples

#### Token Price ($0.001 USDC)
```bash
curl -X POST http://localhost:3000/run \
  -H "Authorization: Bearer nvq_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "token_price",
    "input_data": "bitcoin"
  }'
```

#### Twitter Fetch ($0.05 USDC)
```bash
curl -X POST http://localhost:3000/run \
  -H "Authorization: Bearer nvq_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "twitter_fetch",
    "input_data": "elonmusk"
  }'
```

#### Nemotron 3 Reasoning ($0.10 USDC)
```bash
curl -X POST http://localhost:3000/run \
  -H "Authorization: Bearer nvq_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "nemotron-3-super",
    "input_data": "Explain what makes decentralized micropayments efficient."
  }'
```

---

### 3. Python Integration

```python
import requests

API_KEY = "nvq_your_api_key_here"
BASE_URL = "http://localhost:3000"  # Or your deployed Vercel URL

response = requests.post(
    f"{BASE_URL}/run",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "service_id": "token_price",
        "input_data": "ethereum"
    }
)

if response.status_code == 200:
    data = response.json()
    print("Service Result:", data["result"])
    print("Settled Tx Hash:", data["tx_hash"])
else:
    print(f"Error {response.status_code}:", response.json())
```

---

## API Reference

### Authentication

Protected endpoints require an API key passed via the `Authorization` header:

```http
Authorization: Bearer nvq_your_api_key_here
```

*Note: Both `Bearer nvq_...` and raw `nvq_...` formats are accepted.*

---

### Public Endpoints

#### `GET /health`
Returns backend health and status of Circle API keys and seller wallet configuration.

```bash
curl http://localhost:3000/health
```

**Response:**
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
Lists all registered services with descriptions and pricing.

```bash
curl http://localhost:3000/services
```

**Response:**
```json
[
  {
    "id": "token_price",
    "name": "📈 Token Price",
    "description": "Gets the current price for a given cryptocurrency token.",
    "price_usdc": 0.001
  },
  {
    "id": "twitter_fetch",
    "name": "🐦 Twitter Fetch",
    "description": "Fetches recent tweets for a given keyword or handle.",
    "price_usdc": 0.05
  },
  {
    "id": "nemotron-3-super",
    "name": "🧠 nemotron-3",
    "description": "MoE model with leading domain accuracy for agentic tasks.",
    "price_usdc": 0.1
  }
]
```

---

#### `GET /auth/nonce/{wallet_address}`
Generates a one-time challenge nonce used for EIP-191 signature verification.

```bash
curl http://localhost:3000/auth/nonce/0xYourWalletAddress
```

**Response:**
```json
{
  "nonce": "c3a8e10d9f4b72...",
  "message": "Noviq: Verify wallet ownership\nNonce: c3a8e10d9f4b72...",
  "expires_in": 300
}
```

---

### Service Execution

#### `POST /run` — Direct Payment Execution 🔒
Executes a service and settles payment from the user's Circle wallet to the seller wallet **only upon successful output**. **Requires API Key.**

```json
{
  "service_id": "token_price",
  "input_data": "bitcoin"
}
```

**Response:**
```json
{
  "service_id": "token_price",
  "result": "94210.50",
  "price_usdc": 0.001,
  "tx_hash": "0x5d9f3...b71c"
}
```

---

#### `POST /run-service` — x402 Payment Flow 🔒
Two-step execution flow supporting the [x402 protocol](https://www.x402.org/) with signed EIP-3009 payment authorizations.

- **Step 1:** Call without `X-Payment-Authorization` to receive a `402 Payment Required` challenge:
  ```json
  {
    "scheme": "x402",
    "price_usdc": 0.001,
    "price_usdc_atomic": 1000,
    "token_address": "0x3600000000000000000000000000000000000000",
    "seller_address": "0x373d7eb4c0e4a32daf7625a034ba05e6eabfc6e3",
    "chain_id": 201980,
    "agent_id": "token_price",
    "description": "Run 📈 Token Price on Noviq"
  }
  ```
- **Step 2:** Repeat the request with the `X-Payment-Authorization` header containing the signed authorization payload.

---

### Wallet & Transactions

#### `POST /wallet`
Creates or retrieves the Circle Programmable Wallet assigned to an EVM wallet address.

```json
{
  "user_id": "0xYourWalletAddress"
}
```

**Response:**
```json
{
  "wallet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "address": "0xCircleGeneratedAddress",
  "usdc_balance": 15.25,
  "user_id": "0xYourWalletAddress"
}
```

---

#### `GET /wallet/{user_id}` 🔒
Retrieves wallet details and live USDC balance for the authenticated user. **Requires API Key.**

---

#### `GET /transactions/{user_id}`
Retrieves transaction execution history for a wallet.

```json
[
  {
    "id": 1,
    "user_id": "0xYourWalletAddress",
    "service_id": "token_price",
    "service_name": "📈 Token Price",
    "cost": 0.001,
    "status": "verified",
    "tx_hash": "0x8f2d...19b4",
    "created_at": "2026-09-20T14:32:00.000Z"
  }
]
```

---

### API Key Management

#### `POST /api-keys`
Creates a new API key. Requires a valid cryptographic signature of the nonce challenge.

**Request:**
```json
{
  "wallet_address": "0xYourWalletAddress",
  "label": "production-agent",
  "signature": "0xSignedMessage...",
  "nonce": "c3a8e10d9f4b72..."
}
```

**Response:**
```json
{
  "api_key": "nvq_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
  "key_prefix": "nvq_a1b2c3d4",
  "label": "production-agent",
  "created_at": "2026-09-20T14:30:00.000Z"
}
```

> ⚠️ The full key is displayed **only once** upon generation.

---

#### `GET /api-keys/{wallet_address}`
Lists all active and revoked API keys for the specified wallet.

---

#### `DELETE /api-keys/{key_prefix}` 🔒
Revokes an API key. Can be authorized using either:
1. An active API key in the `Authorization` header, OR
2. A wallet signature (`signature` and `nonce`) in the request body.

```bash
curl -X DELETE http://localhost:3000/api-keys/nvq_a1b2c3d4 \
  -H "Authorization: Bearer nvq_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0xYourWalletAddress"}'
```

---

### Key Policies & Rate Limits

| Rule | Specification |
|---|---|
| **Format** | `nvq_` prefix followed by 48 hex characters (52 characters total) |
| **Max Active Keys** | Maximum 2 active API keys per wallet address |
| **Rate Limit** | 60 requests per minute per key (sliding window) |
| **Revocation** | Immediate via Dashboard UI, API Key, or signed request |

---

### Error Codes

All errors return a predictable JSON payload:

```json
{
  "result": null,
  "error": "Error description message",
  "status_code": 402
}
```

| HTTP Status | Reason | Action |
|---|---|---|
| `400 Bad Request` | Missing or invalid parameters | Check JSON syntax and required fields |
| `401 Unauthorized` | Invalid, missing, or revoked API key | Verify key or generate a new one |
| `402 Payment Required` | Insufficient USDC balance | Fund your wallet with testnet USDC from the faucet |
| `403 Forbidden` | Accessing another user's wallet | Ensure API key matches the requested user ID |
| `404 Not Found` | Unknown service or resource | Check available IDs via `GET /services` |
| `409 Conflict` | Max key limit reached | Revoke an existing key before creating a new one |
| `429 Too Many Requests` | Rate limit exceeded (>60 req/min) | Throttle requests and retry |
| `502 Bad Gateway` | Upstream provider error (LLM or CoinGecko) | Retry after upstream service recovers |

---

## Project Structure

```
noviq/
├── api/
│   ├── __init__.py
│   └── index.py                    # Vercel serverless ASGI entry point & path rewrites
│
├── app/                            # Next.js 16 (App Router) Frontend
│   ├── api-keys/                   # API key management dashboard
│   │   ├── page.tsx
│   │   └── api-keys.css
│   ├── components/                 # Reusable UI components
│   │   ├── Footer.tsx
│   │   ├── Navbar.tsx
│   │   ├── Providers.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── WalletPanel.tsx
│   ├── context/                    # Context providers (wallet, notifications)
│   │   ├── ToastContext.tsx
│   │   └── WalletContext.tsx
│   ├── docs/                       # In-app developer documentation
│   │   ├── page.tsx
│   │   └── docs.css
│   ├── playground/                 # Interactive API tester & live runner
│   │   ├── page.tsx
│   │   └── playground.css
│   ├── globals.css                 # Global CSS variables & design tokens
│   ├── icon.png                    # Brand favicon / app icon
│   ├── layout.tsx                  # Root layout & providers
│   ├── page.css                    # Landing page styles
│   └── page.tsx                    # Landing page
│
├── backend/                        # FastAPI Backend Application
│   ├── __init__.py
│   ├── main.py                     # App factory, API routes, middleware, and handlers
│   ├── auth.py                     # Key generation, hashing, and EIP-191 signature validation
│   ├── config.py                   # Environment loader and global constants
│   ├── database.py                 # PostgreSQL connection pool & queries
│   ├── models.py                   # Pydantic schemas and response models
│   ├── payment.py                  # x402 challenges, balance verification, Circle execution
│   ├── services.py                 # Pluggable service registry (Token Price, Twitter, Nemotron)
│   ├── wallet.py                   # Circle Programmable Wallets client & EIP-55 checksums
│   └── scripts/
│       ├── generate_entity_secret.py    # Generates 32-byte hex entity secret
│       ├── register_entity_secret.py    # Registers secret with Circle Developer Console
│       └── setup_production.py          # Complete bootstrap & seller wallet setup
│
├── public/                         # Static assets
│   └── assets/
│       └── Noviq.png               # Official Noviq brand logo
│
├── .env.example                    # Environment variable template
├── .gitignore
├── eslint.config.mjs               # ESLint configuration
├── next.config.ts                  # Next.js config & dev proxy rewrite rules
├── package.json                    # Node dependencies and project scripts
├── requirements.txt                # Python dependencies
├── tsconfig.json                   # TypeScript configuration
└── vercel.json                     # Vercel deployment & serverless routing config
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling & UI** | Vanilla CSS with custom properties (CSS variables), glassmorphic styling, dark/light theme |
| **Backend Framework** | Python 3.10+, FastAPI, Uvicorn (ASGI) |
| **Serverless Deployment** | Vercel (Next.js frontend + Python serverless functions via `api/index.py`) |
| **Data Validation** | Pydantic v2 |
| **Database** | PostgreSQL via `psycopg2-binary` (pooled connections) |
| **Blockchain Settlement** | Arc Testnet (EVM, Chain ID `201980`) |
| **Payment Rails** | Circle Programmable Wallets (Developer-Controlled), ERC-20 USDC micropayments |
| **Cryptography** | PyCryptodome (RSA-OAEP encryption for entity secret), eth-account (EIP-191 signatures) |
| **External APIs** | NVIDIA NIM API (Nemotron 3), CoinGecko API, Twitter Syndication |

---

## Database Schema

All tables are automatically verified and initialized on backend boot via `database.init_db()`:

### `wallets`
Maps EVM user addresses to Circle Programmable Wallet IDs.
- `user_id` (`TEXT`, PK) — Checksummed EVM address
- `wallet_id` (`TEXT`) — Circle wallet UUID

### `transactions`
Records completed service executions and on-chain settlement details.
- `id` (`SERIAL`, PK) — Auto-incrementing identifier
- `user_id` (`TEXT`) — Caller wallet address
- `service_id` (`TEXT`) — Executed service ID
- `service_name` (`TEXT`) — Display name
- `cost` (`REAL`) — Cost in USDC
- `status` (`TEXT`) — Status (`verified`)
- `tx_hash` (`TEXT`) — On-chain transaction hash
- `created_at` (`TEXT`) — ISO 8601 timestamp

### `api_keys`
Stores hashed API keys and associated wallet metadata.
- `id` (`SERIAL`, PK) — Auto-incrementing identifier
- `key_hash` (`TEXT`, UNIQUE) — SHA-256 hash of the API key
- `key_prefix` (`TEXT`) — First 12 characters (e.g. `nvq_a1b2c3d4`)
- `wallet_address` (`TEXT`) — Owning wallet address
- `label` (`TEXT`) — User-defined label
- `created_at` (`TEXT`) — Creation timestamp
- `last_used_at` (`TEXT`) — Last request timestamp
- `is_revoked` (`BOOLEAN`) — Revocation flag

### `api_rate_limits`
Sliding window rate limit tracker (60 requests/minute).
- `key_hash` (`TEXT`, PK) — Key hash
- `window_start` (`TIMESTAMP`, PK) — Window timestamp
- `request_count` (`INTEGER`) — Current count in window

### `auth_nonces`
Single-use nonces for wallet signature challenges (5-minute expiration).
- `id` (`SERIAL`, PK) — Auto-incrementing identifier
- `wallet_address` (`TEXT`) — Wallet address
- `nonce` (`TEXT`, UNIQUE) — Cryptographic nonce
- `created_at` (`TEXT`) — Creation timestamp
- `consumed` (`BOOLEAN`) — Usage status

### `pending_requests`
Audit log tracking execution lifecycles to guarantee charges only occur on success.
- `id` (`TEXT`, PK) — UUID for the execution request
- `user_id` (`TEXT`) — Caller wallet address
- `service_id` (`TEXT`) — Requested service ID
- `cost` (`REAL`) — Cost in USDC
- `status` (`TEXT`) — Status (`pending`, `completed`, `failed`)
- `created_at` (`TEXT`) — Start timestamp
- `completed_at` (`TEXT`) — Finish timestamp
- `tx_hash` (`TEXT`) — Settlement transaction hash
- `error_message` (`TEXT`) — Error details if execution failed

---

## Deployment & Routing Architecture

Noviq is designed to deploy seamlessly to **Vercel**:
- **Frontend**: Next.js automatically builds the static and server-rendered routes (`/`, `/api-keys`, `/playground`, `/docs`).
- **Backend**: `vercel.json` routes API calls (`/health`, `/services`, `/auth/*`, `/run`, `/run-service`, `/wallet*`, `/transactions/*`, `/api-keys/*`) to `api/index.py`, which wraps the FastAPI application inside a Starlette/ASGI serverless function.
- In local development, `next.config.ts` proxies matching backend routes to `http://127.0.0.1:8000`.

---

## License

This project is currently unlicensed. Contact the maintainers for licensing and usage terms.
