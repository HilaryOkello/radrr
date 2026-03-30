# Radrr

**A community truth network where eyewitnesses capture, verify, and share or sell footage — putting the proof of what happened in the hands of the people who lived it.**

Every major news event of the last decade was first captured by an ordinary person on an ordinary phone. Yet there is no accessible way for that person to prove their footage is authentic, protect it from deletion, or get paid when it matters.

Radrr turns any camera into a tamper-proof evidence vault and any citizen recorder into a participant in the public record — paid, protected, and permanently credited. It runs entirely in the browser. No app install. No professional equipment. No intermediary taking the majority of the money.

---

## The Problem

When something happens in the world, the people nearest to it are the first to see it. A bystander films a protest. A driver captures a hit-and-run. A resident records illegal dumping. A journalist documents a raid.

But the current system fails them at every step:

- **Footage gets deleted** — by device failure, intimidation, or platform takedown
- **Provenance is invisible** — screenshots and re-uploads destroy the chain of custody
- **Recorders go uncompensated** — media outlets, lawyers, and insurers use the footage; the person who risked their safety to capture it sees nothing
- **No proof of authorship** — anyone can claim they filmed something
- **AI-generated fakes erode trust** — without verifiable provenance, even real footage becomes suspect

### The only existing solution costs $6,499

The only video authentication solution available today is Sony's C2PA-compliant Camera Authenticity system, launched in October 2025. It requires a professional camera body starting at $6,499 plus a paid annual digital signature licence. It is designed exclusively for newsroom workflows, not citizen witnesses.

Meanwhile, **416 million people across Africa** are now using mobile internet — the vast majority on affordable Android devices — where the most significant local news events are being captured every day. Those recordings carry no verifiable proof of when, where, or whether they have been altered. Governments delete inconvenient footage. Deepfakes are increasingly indistinguishable from real recordings. And the people who risk their safety to document the truth receive nothing. Their footage is reposted by media organisations without credit, consent, or payment.

The problem isn't that people aren't recording. It's that there's no accessible infrastructure to make their recordings matter.

---

## The Solution

Radrr is a decentralised footage marketplace built on cryptographic truth.

The moment a recording is captured:
1. A Merkle root of the GPS location and timestamp is **anchored on the Filecoin FVM** — immutable, timestamped, on-chain
2. The full footage is **encrypted with Lit Protocol** — no one can see it without paying
3. The public trailer is **stored on Filecoin** — permanently accessible, censorship-resistant
4. AI agents **corroborate the footage** — independent verification, not editorial judgment

When footage is purchased by a journalist, an insurer, a legal team, or anyone who needs verified evidence:
- The witness receives **85% of the payment**, automatically, on-chain
- Corroborating agents share **10%** — incentivising a network of independent verifiers
- The buyer receives a **Hypercert** — a permanent, verifiable record of their contribution to the public record

Hypercerts here are not just receipts. They are **proof of participation in civic infrastructure**. When you buy footage on Radrr, you are funding citizen journalism, supporting evidence-based accountability, and staking your own identity on the value of that moment. The Hypercert is your credential in the emerging ecosystem of verifiable public good.

---

## Who This Is For

**Citizen recorders** — You filmed something that matters. Radrr ensures you're credited, compensated, and that your footage can never be quietly erased.

**Journalists & newsrooms** — Source footage with cryptographic provenance. Know exactly when and where it was captured, verified independently before you publish.

**Legal professionals** — Purchase footage with an unbroken chain of custody from capture to transaction, anchored on a public blockchain.

**Insurers & investigators** — Commission corroborated evidence from geographic areas, verified by AI against reference footage.

**Civil society & NGOs** — Build archives of verified public-interest recordings. Every purchase funds the next recorder.

---

## The Market

### The money in footage is enormous — and almost none of it reaches the person who filmed it

The global stock footage and video licensing market is worth **over $6 billion annually** and growing. But that number obscures where the real demand is: breaking news, verified eyewitness footage, and legally admissible evidence — the exact categories where supply is most scarce and verification costs are highest.

**Where newsrooms spend:**
- AP, Reuters, and Getty charge between **$300 and $3,000+ per clip** for archival news footage
- Exclusive eyewitness footage of major events can sell for **tens of thousands of dollars** — the person who filmed it typically receives 20–50% after platform cuts
- Newsrooms spend an estimated **$50,000–$500,000 per year** on UGC verification services (Storyful, NewsGuard, AFP Fact Check) — manual analyst work to confirm footage isn't fabricated or mislabelled
- A single deepfake investigation by a newsroom's visual forensics team can cost **$10,000–$50,000** in analyst time

**Where legal and insurance money goes:**
- The US litigation market alone spends hundreds of millions annually on video evidence authentication
- Insurance adjusters routinely commission private investigators to locate and authenticate accident footage — a process that can take weeks and cost thousands per case
- Law enforcement agencies pay for commercial platforms to source and verify footage; those platforms are centralised, proprietary, and expensive

**The UGC licensing platforms take most of the money:**

| Platform | Creator's cut | Verification method | Storage | Provenance |
|---|---|---|---|---|
| Jukin Media | 30–50% | Manual editorial | Centralised | None |
| Newsflare | 50% | Manual editorial | Centralised | None |
| Storyful | 0% (subscription) | Manual OSINT | Centralised | None |
| Stringr | ~50% | Manual | Centralised | None |
| AP/Reuters/Getty | 20–35% | Editorial only | Centralised | None |
| **Radrr** | **85%** | **SigLIP 2 AI + on-chain** | **Filecoin (permanent)** | **Cryptographic** |

### The authenticity crisis is getting worse

The emergence of generative AI has collapsed the baseline assumption that video footage is real. In 2024, multiple major news events were accompanied by viral deepfakes that took days to debunk. Newsrooms now treat every piece of UGC as suspect until manually verified — a process that is slow, expensive, and doesn't scale.

The C2PA standard (backed by Adobe, Microsoft, BBC, and others) is the industry's attempt to solve this. It relies on device manufacturers opting in and charges per-device licence fees. It provides no economic incentive for recorders or verifiers. It is, by design, a solution for hardware manufacturers and large media workflows — not for the person with a phone in their pocket at the wrong place at the right time.

Radrr's approach is different: **provenance is enforced at the infrastructure level**, not the policy level. The proof is on-chain before the recorder even sets a price. Corroboration is done by economically incentivised AI agents with on-chain reputation scores. No editor needs to trust anything — the math does.

### The opportunity

The market is moving toward verified content. Regulators in the EU and UK are beginning to require provenance metadata for AI-generated and UGC content used in broadcast. Legal standards for digital evidence are tightening. Media organisations are building internal verification teams they cannot afford to scale.

Radrr's model turns verification from a cost centre into a market. Corroborators are paid by the purchase. Witnesses are paid directly. Buyers get a Hypercert — proof they funded a piece of the verified public record. The economics align every participant's incentives without a centralised intermediary taking the majority of the value.

---

## Why Decentralisation is Not Optional

A centralised version of this already exists. It is called Getty Images, Storyful, and Reuters Connect. They take 70–80% of revenue. They can delete footage under government pressure. They can be hacked and evidence destroyed. They require journalists to trust a private company's editorial judgment about what is authentic.

Radrr uses the decentralised stack as structural enforcement, not as decoration:

- **Filecoin** makes footage undeletable. A CID pinned to Filecoin cannot be removed by a platform, a government, or a court order served on a startup.
- **The Filecoin FVM** makes the proof tamper-evident. The Merkle root of GPS and timestamp is on-chain before any sale. No one — not even Radrr — can alter it retroactively.
- **Lit Protocol** makes access control trustless. The decryption key is never held by a server. It is released by a Lit Action that checks `isPurchased()` on-chain. No payment, no access — enforced by code, not policy.
- **Storacha** makes storage witness-owned. UCAN delegation means the witness's storage space is theirs, not Radrr's. The platform going offline does not make footage disappear.
- **Smart contracts** make payments automatic and uncensorable. 85% reaches the witness wallet the moment a purchase confirms. No invoice, no 90-day payment cycle, no intermediary discretion.
- **ERC-8004 on-chain identity** means corroborating agents carry reputation that cannot be faked or reset. A high-reputation agent's corroboration means something because it is built from a public, auditable history.

Each component is load-bearing. Remove any one of them and you are back to trusting a company.

---

## Architecture

### High-Level Data Flow

```
 Browser (Witness)                    Next.js API                        Filecoin FVM
 ─────────────────                    ──────────                         ────────────
  [Record video]
       │  MediaRecorder WebM
       ▼
  [Generate trailer]──── FFmpeg.wasm ──►  /api/upload-trailer ──► Storacha (CID)
       │
  [Encrypt full video]── Lit Protocol ──► /api/upload-encrypted ──► Storacha (CID)
       │  AES-256-GCM ciphertext             (if Lit unreachable: local AES key)
       │
  [Anchor on-chain]──────────────────► /api/record
       │                                     │
       │                             keccak256(GPS + timestamp)
       │                             Merkle root
       │                                     │
       │                              Radrr.sol.anchor()
       │                                     │
       │                          ◄── txHash ── Filecoin FVM Calibration
       │
  [Publish / set price]
       │
       ▼
  Public listing — trailer visible, full footage encrypted
```

### Purchase & Decryption Flow

```
 Browser (Buyer)                      Next.js API                     Filecoin FVM
 ───────────────                      ──────────                      ────────────
  [Buy recording]
       │  price in tFIL
       ▼
  Radrr.sol.purchase()
       │  85% → witness (automatic, on-chain)
       │  10% → corroborators (split between verifiers)
       │   5% → platform
       ▼
  isPurchased(recordingId, buyer) == true
       │
       ▼
  /api/purchase
       │
       ├──► Lit Protocol session sigs
       │    └─► Lit Action calls isPurchased() on Filecoin RPC
       │    └─► decryptToString() → full video
       │
       ├──► Mint Hypercert (AT Protocol)
       │    └─► org.hypercerts.claim.activity on certified.one
       │    └─► permanent credential: you funded verified journalism
       │
       └──► return decrypted video URL to buyer
```

### Corroboration Pipeline

```
 AI Agent (server)
 ─────────────────
  for each unverified recording:
       │
       ├─► fetch trailer frames from Storacha
       │
       ├─► SigLIP 2 embeddings (HuggingFace API)
       │       model: google/siglip-so400m-patch14-384
       │
       ├─► cosine_similarity(trailer_embedding, reference_embedding)
       │       ≥ 0.85 → corroborate (earn 10% share of all future purchases)
       │       < 0.85 → reject
       │
       ├─► Radrr.sol.corroborate(recordingId, verdict)
       │
       ├─► agent execution log pinned to Filecoin via Storacha
       │
       └─► ERC-8004 reputation updated on AgentRegistry.sol
               consistent corroborators build on-chain credibility
```

### Agent Identity (ERC-8004)

```
 AgentRegistry.sol (0x49c4...)
 ─────────────────────────────────────────────────────────
  ┌──────────────────────┬──────────────────────────────────┐
  │  Identity Registry   │  registerAgent(did, metadata)    │
  │  (ERC-8004 §2)       │  getAgent(address) → DID + meta  │
  ├──────────────────────┼──────────────────────────────────┤
  │  Reputation Registry │  updateReputation(addr, delta)   │
  │  (ERC-8004 §3)       │  getReputation(addr) → score     │
  ├──────────────────────┼──────────────────────────────────┤
  │  Validation Registry │  validate(claimId, verdict)      │
  │  (ERC-8004 §4)       │  getValidation(claimId)          │
  └──────────────────────┴──────────────────────────────────┘
  Every corroboration creates an immutable validation record.
  Agents with high reputation scores carry more evidential weight.
```

### Hypercerts Flow

```
 Purchase confirmed on-chain
       │
       ▼
  /api/purchase
       │
       ├─► AT Protocol login (certified.one PDS)
       │
       ├─► com.atproto.repo.createRecord
       │       collection: org.hypercerts.claim.activity
       │       record: { recordingId, buyer, txHash, timestamp, location }
       │
       └─► Hypercert URI returned and stored
               ↳ buyer now holds a permanent, portable credential
               ↳ proof they supported verified public-interest recording
               ↳ queryable by wallet via /api/hypercerts/by-owner/[address]
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind | UI |
| Recording | MediaRecorder API, FFmpeg.wasm | In-browser WebM capture, trailer generation |
| Blockchain | Filecoin FVM Calibration (chain 314159) | Immutable anchoring, purchase, bidding |
| Smart contracts | Solidity 0.8, Hardhat | Radrr.sol, AgentRegistry.sol, Multicall3.sol |
| Decentralised storage | Storacha (w3up / Filecoin Pin) | Video, metadata, agent logs — all on Filecoin |
| Encryption | Lit Protocol V1 (Naga / DatilDev) | Access-controlled decryption on purchase |
| AI corroboration | SigLIP 2 via HuggingFace Inference API | Visual embedding similarity (threshold 0.85) |
| Identity | ERC-8004 (all 3 registries) | On-chain agent identity + reputation |
| Certificates | AT Protocol (certified.one) | Hypercerts minted on purchase |
| Payments | tFIL, on-chain splits | 85/10/5 automatic distribution |

---

## Smart Contracts (Filecoin Calibration — chain 314159)

| Contract | Address | Description |
|---|---|---|
| `Radrr.sol` | `0x189a06cD3afd146a53B4f096aB6E4bcdb79068AD` | Core: anchor, purchase (85/10/5 split), bid, corroborate |
| `AgentRegistry.sol` | `0x49c483c7DE2A8dD58ca44d664539e069b045bc4D` | ERC-8004 identity, reputation, validation registries |
| `Multicall3.sol` | `0x519Bc263133Beee1f4CacCCb4f2EB60503177AcD` | Deployed because canonical `0xcA11...` is not on Calibration |

Explorer: [calibration.filfox.info](https://calibration.filfox.info/en)

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/record` | POST | Anchor recording Merkle root on Filecoin FVM |
| `/api/upload-encrypted` | POST | Encrypt video with Lit + upload to Storacha |
| `/api/upload-trailer` | POST | Upload public trailer/thumbnail to Storacha |
| `/api/purchase` | POST | Verify purchase, decrypt video, mint Hypercert |
| `/api/corroborate` | POST | SigLIP 2 corroboration pipeline |
| `/api/identity` | GET | ERC-8004 agent identity lookup |
| `/api/recordings` | GET | List public recordings |
| `/api/hypercerts/by-owner/[address]` | GET | Hypercerts for a wallet address |
| `/api/bids/by-bidder/[address]` | GET | Bids placed by a wallet |

---

## Sponsor Integrations

### Filecoin / Storacha
- All footage uploaded via `@storacha/client` (`uploadFile`) to Filecoin — no central server holds video
- Recording metadata and agent logs pinned as JSON via `uploadJson` (Filecoin Pin)
- Radrr.sol and AgentRegistry.sol deployed on Filecoin FVM Calibration
- `Multicall3.sol` deployed at `0x519Bc...` (canonical `0xcA11...` not available on Calibration)
- Synapse SDK client initialised with custom Multicall3 override; full storage payment integration ready once Synapse ships Calibration contracts

### Lit Protocol
- Encryption at upload: `LitJsSdk.encryptString()` with access control conditions tied to `isPurchased()`
- Lit Action calls `isPurchased(recordingId, buyer)` on Filecoin Calibration RPC — no server ever holds keys
- GPS coordinates also encrypted with the same conditions — precise location only revealed to buyer
- Decryption: `LitJsSdk.decryptToString()` with session signatures after on-chain purchase confirmed
- AES-256-GCM local fallback when Lit nodes unreachable (demo resilience; key management note in `lib/lit.ts`)

### Hypercerts (AT Protocol)
- Minted on every purchase via `org.hypercerts.claim.activity` record on certified.one PDS
- The Hypercert is the buyer's proof they funded a piece of the public record
- Queried by wallet address via `com.atproto.repo.listRecords`

### ERC-8004 (Agents With Receipts)
- `AgentRegistry.sol` implements all three ERC-8004 registries in one contract
- Every corroboration creates an on-chain validation record; agent reputation is updated
- High-reputation agents carry more evidential weight in future corroborations
- `app/api/identity/route.ts` exposes agent identity lookups

### SigLIP 2 (AI Corroboration)
- `google/siglip-so400m-patch14-384` via HuggingFace Inference API
- Visual embeddings compared with cosine similarity — threshold 0.85
- Corroborating agents earn a share of every future purchase of the recording
- `lib/siglip.ts`, `app/api/corroborate/route.ts`

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Filecoin Calibration wallet with tFIL ([faucet](https://faucet.calibration.fildev.network/))
- Storacha space + delegation proof
- HuggingFace API key
- certified.one account (for Hypercerts)

### Install

```bash
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `FILECOIN_CONTRACT_ADDRESS` | Radrr.sol address on Calibration |
| `FILECOIN_AGENT_REGISTRY_ADDRESS` | AgentRegistry.sol address |
| `FILECOIN_AGENT_ADDRESS` | Agent wallet address |
| `FILECOIN_AGENT_PRIVATE_KEY` | Agent private key (`0x...`) |
| `FILECOIN_RPC_URL` | Calibration RPC (default: glif.io) |
| `NEXT_PUBLIC_FILECOIN_CONTRACT_ADDRESS` | Same, exposed to browser |
| `NEXT_PUBLIC_FILECOIN_CHAIN_ID` | `314159` |
| `EVM_PLATFORM_PRIVATE_KEY` | Platform deployer wallet |
| `STORACHA_PROOF` | Base64-encoded w3up delegation CAR |
| `STORACHA_PRINCIPAL` | Base64-encoded ed25519 principal (optional) |
| `CERTIFIED_APP_HANDLE` | certified.one handle |
| `CERTIFIED_APP_PASSWORD` | AT Protocol app password |
| `CERTIFIED_APP_DID` | DID (optional, speeds up queries) |
| `CERTIFIED_APP_PDS` | PDS URL (`https://certified.one`) |
| `HUGGINGFACE_API_KEY` | HuggingFace token for SigLIP 2 |

### Storacha Space Setup

```bash
npm install -g @web3-storage/w3cli
w3 login <email>
w3 space create radrr-space
# Start the app once to get your server DID, then:
w3 delegation create <server-did> --can 'store/add' --can 'upload/add' | base64
# Paste output into STORACHA_PROOF
```

### Run

```bash
npm run dev
```

### Deploy Contracts

```bash
cd contracts/filecoin
npx hardhat run deploy.ts --network filecoin_calibration
# Multicall3 (if needed on a new network):
npx hardhat run deploy-multicall3.cjs --network filecoin_calibration
```

---

## Project Structure

```
radrr-app/
├── app/
│   ├── api/
│   │   ├── record/            # Anchor recording on Filecoin FVM
│   │   ├── upload-encrypted/  # Lit encrypt + Storacha upload
│   │   ├── upload-trailer/    # Public trailer upload
│   │   ├── purchase/          # Purchase verification + Hypercert mint
│   │   ├── corroborate/       # SigLIP 2 AI corroboration
│   │   ├── identity/          # ERC-8004 agent identity
│   │   ├── recordings/        # Public listing
│   │   ├── bids/              # Bid queries
│   │   └── hypercerts/        # Hypercert queries
│   ├── record/                # Recording UI
│   ├── recording/[id]/        # Recording detail + purchase
│   └── page.tsx               # Homepage
├── components/                # UI components
├── contracts/filecoin/
│   └── src/
│       ├── Radrr.sol          # Core marketplace contract
│       ├── AgentRegistry.sol  # ERC-8004 registries
│       └── Multicall3.sol     # Deployed Multicall3
├── lib/
│   ├── storacha.ts            # Filecoin Pin via w3up
│   ├── lit.ts                 # Lit Protocol encrypt/decrypt
│   ├── synapse.ts             # Synapse SDK client + Filecoin Pin
│   ├── siglip.ts              # SigLIP 2 embeddings
│   ├── hypercerts.ts          # AT Protocol Hypercerts
│   └── filecoin.ts            # FVM contract interactions
└── public/
```
