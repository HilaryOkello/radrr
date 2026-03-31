# Hackathon Submission — PL Genesis: Frontiers of Collaboration

---

## Project Name
Radrr

## Tagline
A decentralised marketplace where eyewitnesses capture, verify, and sell footage — putting cryptographic proof of what happened in the hands of the people who lived it.

## Description (300–500 words)

Every major news event of the last decade was first captured by an ordinary person on an ordinary phone. Yet there is no accessible way for that person to prove their footage is authentic, protect it from deletion, or get paid when it matters. The only video authentication solution that exists today is Sony's C2PA-compliant camera system — starting at $6,499 plus a paid annual licence, designed for newsroom workflows, not citizen witnesses. Meanwhile, 416 million people across Africa are recording the most significant local news events every day on affordable Android devices, with no verifiable proof of when, where, or whether their footage has been altered. Radrr fixes this.

Radrr is a decentralised marketplace for citizen footage with cryptographic provenance. Any person with a camera can record anything, upload it in-browser, and have it permanently anchored to the public record — before any sale, before any negotiation, before anyone can pressure them to delete it.

The moment a recording is captured, a Merkle root of its GPS location and timestamp is anchored on the Filecoin FVM. The full footage is AES-256-GCM encrypted client-side — the server never sees the plaintext. The encryption key is XOR-obfuscated and stored on IPFS with its CID anchored on-chain. A public trailer is pinned to Filecoin via Storacha. Two autonomous AI agents independently verify the footage: a corroboration agent using SigLIP 2 visual embeddings, and a trust agent that monitors the corroboration agent's own on-chain reputation before endorsing its attestations.

When a journalist, insurer, legal team, or anyone needing verified evidence purchases the footage, the smart contract enforces an 85/10/5 split — 85% goes directly to the witness, 10% is shared among corroborators, 5% to the platform. The buyer's wallet triggers client-side decryption: the encrypted key is fetched from IPFS, XOR-decrypted, and used to unlock the full footage in-browser. No server ever holds the key. The buyer receives a Hypercert: a permanent, portable credential proving they funded a piece of the verified public record.

Agents are registered on-chain via ERC-8004, with identity, reputation, and validation history stored in AgentRegistry.sol. Every corroboration and every purchase updates agent reputation on-chain. A dedicated Agent Status page at `/agent` shows both agents' live reputation scores, earned credentials, and structured activity logs with Filecoin explorer links. The trust agent adds a second layer: it only issues a `trust-endorsed` credential to the corroboration agent if its ERC-8004 reputation score is ≥ 700/1000 — making trust in AI attestations auditable and earned, not assumed.

The business case is real. The global stock footage market exceeds $6 billion annually. Existing UGC platforms take 50–80% of licensing fees and offer no cryptographic provenance. Newsrooms spend hundreds of thousands per year on manual verification services that cannot scale. Radrr replaces expensive editorial judgment with economically incentivised on-chain verification, cuts platform fees from 50–80% to 5%, and gives the person who risked their safety to film something both immediate payment and a permanent credit in the public record.

## Prototype / Demo URL
[TODO: Add deployed URL]

## Video Demo
[TODO: Add YouTube link — ≤ 3 minutes]

## Code Type
**Fresh Code** — repository created March 22, 2026, entirely within the hackathon window (after Feb 10 kickoff).

## When did you start building this project?
March 22, 2026, during the hackathon.

## GitHub Repository
[TODO: Add public repo URL]

---

## Tracks & Challenges Entering

### Protocol Labs Track Prizes
| Challenge | Why we qualify |
|---|---|
| **AI & Robotics** ($6,000) | Two ERC-8004 autonomous agents with full decision loops, multi-agent trust chain, reputation-based credential issuance, verifiable AI attestations on-chain |
| **Infrastructure & Digital Rights** ($6,000) | Decentralised Filecoin/Storacha storage, client-side AES-256-GCM encryption, censorship-resistant footage anchoring, data ownership — no platform can delete or access content |
| **Fresh Code** ($50,000) | Repo created March 22, 2026; all core functionality built during hackathon window |

### Ethereum Foundation Challenges
| Challenge | Why we qualify |
|---|---|
| **🔐 Agents With Receipts — 8004** ($4,004) | All three ERC-8004 registries implemented in AgentRegistry.sol (identity, reputation, validation); two agents registered on-chain; onchain verifiable tx history; `agent.json` + `agent_log.json` DevSpot manifests; trust-gated multi-agent coordination |
| **🤖 Agent Only: Let the agent cook** ($4,000) | Full 7-phase autonomous decision loop (discover → plan → execute → verify → commit → reputation → log); ERC-8004 identity registered on-chain; multi-tool orchestration (HuggingFace, Filecoin FVM, Storacha, Synapse SDK); safety guardrails; multi-agent system; ERC-8004 trust signals (bonus) |

### Sponsor Bounties
| Challenge | Why we qualify |
|---|---|
| **Filecoin** ($2,500) | Synapse SDK integrated for agent log storage; Storacha `@storacha/client` for all video/metadata/logs; deployed on Filecoin Calibration Testnet; open-source with working demo |
| **Hypercerts** ($2,500) | Hypercerts minted on every verified purchase via `org.hypercerts.claim.activity` on certified.one PDS; permanent impact attestation for buyers; queryable by wallet address |
| **Storacha** ($500 + credits) | `@storacha/client` used for persistent agent memory — structured execution logs uploaded to Filecoin after every agent cycle; multi-agent coordination via shared Storacha-backed log; stable `ed25519` principal across restarts |

---

## Technologies / Tools Integrated

### Protocol Labs / Filecoin
- Decentralised storage: all footage on Filecoin via Storacha — no central server holds video
- Cryptographic provenance: Merkle root anchored on FVM at capture time, before any negotiation
- Censorship resistance: footage CID is immutable once pinned on Filecoin; no party can delete it
- Client-side AES-256-GCM encryption ensures server compromise does not expose footage

### Filecoin FVM
- Smart contracts deployed on Filecoin FVM Calibration (chain 314159)
- `Radrr.sol`: `0x0B02E8eC8624E7e0024979D14735Bb5F4c10B182`
- `AgentRegistry.sol`: `0x76bd383BB3a4824131DC114dfE79e2BC0CfE6c89`
- Purchase splits (85/10/5 tFIL) enforced automatically on-chain
- Storacha Filecoin Pin for all video, metadata, and agent logs
- Synapse SDK client integrated with custom Multicall3 override on Calibration
- All contract interactions via viem in `lib/filecoin.ts`

### ERC-8004 Agent Identity & Reputation
- `AgentRegistry.sol` implements all three ERC-8004 registries in one contract:
  - Identity Registry (§2): `registerAgent`, `getAgent`
  - Reputation Registry (§3): `recordTaskSuccess`, `recordTaskFailure`, `getAgentReputation`
  - Validation Registry (§4): `issueCredential`, `hasCredential`
- Every corroboration creates an on-chain validation record with reason string
- Agent reputation updated after every task — both success and failure
- Purchase events trigger `recordAgentTaskSuccess()` — marketplace activity directly feeds agent reputation
- Second agent (trust agent) issues `trust-endorsed` credential only if score ≥ 700/1000
- Agent manifest at `public/agent.json`; status UI at `app/agent/page.tsx`
- Explorer links for all on-chain agent activity via Filfox
- Corroboration agent: `0xa93414A1E97C09f982b83E2134E21C1Cb46Be081`
- Trust agent: `0x2efa5ebcA68341C3f9c21d02426Bca69aEe19D01`

### AI Corroboration (SigLIP 2)
- SigLIP 2 (`google/siglip-so400m-patch14-384`) via HuggingFace Inference API
- Cosine similarity threshold 0.85 for corroboration decisions
- Corroboration agent runs a 7-phase decision loop every 30 seconds: discover → plan → execute → verify → commit → reputation → log
- Trust agent runs every 60 seconds, reads corroboration agent's ERC-8004 score, endorses or withholds based on threshold 700/1000
- Agent status visible in UI at `/agent` with live reputation gauges, credentials, and activity logs
- All agent phases structured and logged to `agent_log.json`, stored on Filecoin via Storacha
- `lib/siglip.ts`, `agents/corroboration-agent.ts`, `agents/trust-agent.ts`

### Hypercerts (AT Protocol)
- Hypercerts minted on every verified purchase via AT Protocol (`org.hypercerts.claim.activity`)
- Stored on certified.one PDS — portable, permanent proof of contribution
- Queried by wallet address via `com.atproto.repo.listRecords`
- Implemented in `lib/hypercerts.ts`, triggered from `/api/purchase`

### Storacha
- `@storacha/client` used for all persistent storage
- `uploadFile()` for encrypted video, public trailers, thumbnails
- `uploadJson()` for recording metadata and structured agent execution logs (persistent agent memory)
- Stable `ed25519` principal across restarts (`STORACHA_PRINCIPAL` env var)
- Delegation proof via `w3 delegation create` CLI flow

---

## Team
[TODO: List team members and roles]

## Social Handles (LinkedIn / Discord / X)
[TODO: Add per-contributor social handles for winner notification]

## Contact
[TODO: Email / Discord / Telegram]
