## What is Noviq?

Noviq is a **pay-per-request AI services marketplace** built on [Circle's Nanopayments](https://developers.circle.com/) and the [Arc testnet](https://arc-testnet.drpc.org). It lets users consume AI-powered services — like fetching live crypto prices or Twitter data — paying fractions of a cent per request using **USDC**.

The payment flow follows the [x402 protocol](https://www.x402.org/): the server issues an HTTP `402 Payment Required` challenge, the client signs an off-chain EIP-3009 authorization, and the server verifies and settles the payment via Circle's Programmable Wallets — **all without gas fees for the end-user**.

### Key Features

- **Zero-friction wallets** — Circle Developer-Controlled Wallets are created server-side. No browser extensions, no seed phrases.
- **Micro-payments via USDC** — Services cost $0.02–$0.08 per request, settled on-chain in batches.
- **x402 payment protocol** — Standards-based HTTP payment challenge/response flow.
- **Pluggable service registry** — Add new AI/data services by registering a single function.
- **Live on-chain settlement** — Real USDC transfers on Arc testnet via Circle's contract execution API.
- **Modern glassmorphism UI** — Responsive single-page frontend with animated code backgrounds, wallet panel, and transaction history.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (SPA)                      │
│  HTML / CSS / Vanilla JS — served by FastAPI at /       │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Wallet  │  │ Service  │  │ Payment  │  │  Tx     │  │
│  │ Connect │  │ Catalog  │  │ Signing  │  │ History │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────────┘  │
└───────┼────────────┼─────────────┼──────────────────────┘
        │            │             │
        ▼            ▼             ▼
┌─────────────────────────────────────────────────────────┐
│               Backend (FastAPI + Uvicorn)                │
│                                                         │
│  POST /wallet          — Create/retrieve Circle wallet  │
│  GET  /wallet/{uid}    — Get wallet + USDC balance      │
│  GET  /services        — List available services        │
│  POST /run-service     — Execute service (402 flow)     │
│  GET  /health          — Server health check            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ wallet.py│  │payment.py│  │    services.py        │  │
│  │          │  │          │  │  ┌────────────────┐    │  │
│  │ Circle   │  │ x402     │  │  │ Token Price    │    │  │
│  │ Wallets  │  │ Verify   │  │  │ Twitter Fetch  │    │  │
│  │ API      │  │ + Settle │  │  └────────────────┘    │  │
│  └──────────┘  └──────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
        │                │
        ▼                ▼
   Circle API       Arc Testnet
   (Wallets,        (USDC ERC-20,
    Tx Exec)         On-chain Settle)
```

---

## Project Structure

```
Noviq/
├── backend/
│   ├── main.py              # FastAPI application & route definitions
│   ├── config.py            # Environment variables & constants
│   ├── models.py            # Pydantic request/response models
│   ├── wallet.py            # Circle Programmable Wallets integration
│   ├── payment.py           # x402 payment challenge, verification & settlement
│   ├── services.py          # Service registry & execution engine
│   ├── requirements.txt     # Python dependencies
│   └── scripts/
│       ├── generate_entity_secret.py   # Generate a 32-byte entity secret
│       ├── register_entity_secret.py   # Register entity secret with Circle
│       └── setup_production.py         # Production setup helper
│
├── frontend/
│   ├── index.html           # Single-page application markup
│   ├── styles.css           # Full design system (glassmorphism, animations)
│   ├── app.js               # Client-side state, wallet, payment & UI logic
│   └── assets/
│       ├── Noviq.png            # Logo
│       ├── Noviq_favicon.png    # Favicon
│       └── noviq_hero_bg.png    # Hero background image
│
├── .env.example             # Template for environment variables
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| pip | latest |
| Circle Developer Account | [console.circle.com](https://console.circle.com) |

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Noviq.git
cd Noviq
```

### 2. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Description |
|----------|-------------|
| `CIRCLE_API_KEY` | API key from [Circle Console](https://console.circle.com) |
| `CIRCLE_ENTITY_SECRET` | 64-char hex string (32 bytes). Generate with the script below. |
| `SELLER_WALLET_ADDRESS` | Your marketplace wallet address (created on first run) |
| `NVIDIA_API_KEY` | *(Optional)* For future LLM-powered services |

#### Generate & register your entity secret

```bash
# Step 1: Generate a random entity secret
python backend/scripts/generate_entity_secret.py

# Step 2: Register it with Circle (paste the hex string when prompted)
python backend/scripts/register_entity_secret.py
```

### 4. Run the server

```bash
python backend/main.py
```

The app starts on **http://localhost:8000**:
- **UI** → [http://localhost:8000](http://localhost:8000)
- **API docs** → [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger)
- **ReDoc** → [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 5. Get testnet USDC

Visit the [Circle Faucet](https://faucet.circle.com/) and request testnet USDC for your wallet address on the **Arc Testnet** network.

---

## API Reference

### `GET /health`

Returns server health and configuration status.

```json
{
  "status": "ok",
  "circle_api_key_set": true,
  "entity_secret_set": true,
  "seller_wallet_configured": true
}
```

---

### `GET /services`

Lists all available services and their per-request pricing.

```json
[
  {
    "id": "token_price",
    "name": "📈 Token Price",
    "description": "Gets the current price for a given cryptocurrency token.",
    "price_usdc": 0.02
  },
  {
    "id": "twitter_fetch",
    "name": "🐦 Twitter Fetch",
    "description": "Fetches recent tweets for a given keyword or handle.",
    "price_usdc": 0.05
  },
  {
    "id": "llama-3.1-8b-instruct",
    "name": "🧠 llama-3.1-8b-instruct",
    "description": "Ask an advanced LLM any question.",
    "price_usdc": 0.10
  }
]
```

---

### `POST /run-service`

Execute a service. Follows the **x402 payment flow**:

1. **First call** (no auth header) → returns `402` with a payment challenge.
2. **Second call** (with `X-Payment-Authorization` header) → verifies payment, executes on-chain transfer, runs the service.

**Request body:**
```json
{
  "service_id": "token_price",
  "input_data": "bitcoin",
  "user_id": "session-abc123"
}
```

**402 challenge response:**
```json
{
  "scheme": "x402",
  "price_usdc": 0.02,
  "price_usdc_atomic": 20000,
  "token_address": "0x3600000000000000000000000000000000000000",
  "seller_address": "0x...",
  "chain_id": 201980,
  "agent_id": "token_price",
  "description": "Run 📈 Token Price on Noviq"
}
```

**Success response (with valid payment):**
```json
{
  "service_id": "token_price",
  "result": "The current price of bitcoin is $67432.00 USD.",
  "payment_ref": "0xabc...def",
  "authorization_status": "verified"
}
```

---

### `POST /wallet`

Create or retrieve a Circle Developer-Controlled Wallet.

**Request:**
```json
{ "user_id": "session-abc123" }
```

**Response:**
```json
{
  "wallet_id": "ws-...",
  "address": "0x...",
  "usdc_balance": 10.5,
  "user_id": "session-abc123"
}
```

---

### `GET /wallet/{user_id}`

Retrieve an existing wallet and its live USDC balance (queried on-chain via Arc testnet RPC).

---

## Payment Flow (x402)

```
Client                          Server                    Circle / Arc
  │                               │                           │
  │  POST /run-service            │                           │
  │  (no auth header)             │                           │
  │ ─────────────────────────────▶│                           │
  │                               │                           │
  │  ◀── 402 Payment Required ───│                           │
  │       (payment challenge)     │                           │
  │                               │                           │
  │  Sign EIP-3009 authorization  │                           │
  │  (off-chain, no gas)          │                           │
  │                               │                           │
  │  POST /run-service            │                           │
  │  X-Payment-Authorization: ... │                           │
  │ ─────────────────────────────▶│                           │
  │                               │── Verify signature ──────▶│
  │                               │── Execute USDC transfer ─▶│
  │                               │◀── tx hash ──────────────│
  │                               │                           │
  │                               │── Run AI service          │
  │  ◀── 200 OK + result ────────│                           │
```

---

## Available Services

| Service | ID | Price (USDC) | Description |
|---------|-----|-------------|-------------|
| 📈 Token Price | `token_price` | $0.02 | Live crypto price via CoinGecko |
| 🐦 Twitter Fetch | `twitter_fetch` | $0.05 | Recent tweets by keyword/handle |
| 🧠 llama-3.1-8b-instruct | `llama-3.1-8b-instruct` | $0.10 | Ask an advanced LLM any question. |

### Adding a New Service

1. Define an async handler in `backend/services.py`:

```python
async def my_service(input_data: str) -> str:
    # Your logic here
    return f"Result for: {input_data}"
```

2. Register it in `SERVICE_REGISTRY`:

```python
SERVICE_REGISTRY["my_service"] = ServiceDefinition(
    id="my_service",
    name="🚀 My Service",
    description="Does something amazing.",
    price_usdc=0.03,
    fn=my_service,
)
```

That's it — the service will automatically appear in the UI and API.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python, FastAPI, Uvicorn, Pydantic, httpx |
| **Frontend** | Vanilla HTML/CSS/JS, Inter + JetBrains Mono fonts |
| **Payments** | Circle Programmable Wallets, USDC, x402 protocol |
| **Blockchain** | Arc Testnet (Chain ID: 201980) |
| **Crypto** | PyCryptodome (RSA-OAEP for entity secret encryption) |

---

## Development

```bash
# Run with auto-reload (development)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Or simply
python backend/main.py
```

The FastAPI server serves both the API and the frontend static files. No separate build step is needed for the frontend.

---

## License

This project is open source under the [MIT License](LICENSE).

---