# 🛡️ Sentinel — AI Security Triage Agent with Persistent Semantic Memory

> **Memory-Augmented Vulnerability Triage** powered by **[Hindsight Cloud](https://ui.hindsight.vectorize.io)** and **Groq (`openai/gpt-oss-120b`)**, built for autonomous security teams.

---

## 🎯 The Problem

Security scanners (SAST, DAST, SCA, secret linters) generate hundreds of alerts per week. Security teams spend 70%+ of their time manually triaging false positives or re-evaluating the same edge cases:
- *“We know this prototype pollution is in a devDependency and never ships to prod.”*
- *“This open redirect is protected by the allow-list in commit `a1b2c3d`.”*
- *“This hardcoded secret is a mock Stripe key in `tests/fixtures/`.”*

Traditional LLM triage agents are stateless — every scan starts from scratch, repeating the same mistakes and frustrating developers with false alarms.

---

## 💡 The Solution: Hindsight-Powered Memory Architecture

Sentinel uses **[Hindsight Cloud](https://ui.hindsight.vectorize.io)** to give the AI triage agent **persistent organizational memory**:

```
                         ┌────────────────────────────────────────┐
                         │       Security Scanner Alerts          │
                         └───────────────────┬────────────────────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │ Triage Agent (Groq)│
                                  └──────────┬─────────┘
                                             │
                   ┌─────────────────────────┴─────────────────────────┐
                   ▼                                                   ▼
       ┌───────────────────────┐                           ┌───────────────────────┐
       │   Hindsight Cloud     │                           │   PostgreSQL Audit    │
       │   - Semantic Recall   │                           │   - Verdicts & Findings│
       │   - Hybrid Reranker   │                           │   - Human Overrides   │
       │   - Agentic Reflect   │                           │   - Poisoning Defense │
       └───────────┬───────────┘                           └───────────────────────┘
                   │
                   ▼
       ┌────────────────────────────────────────────────────────┐
       │ Context-Aware Verdict: True Positive / False Positive  │
       │ Severity Rating + Fix Recommendations + Citations      │
       └────────────────────────────────────────────────────────┘
```

1. **Semantic Recall**: Before analyzing a finding, the agent queries Hindsight using hybrid search (vector embeddings + BM25 keyword matching + cross-encoder reranking) with CWE structural boosts.
2. **Context-Aware Reasoning**: The Groq LLM evaluates the vulnerability against past institutional knowledge and explicitly cites the recalled memory IDs.
3. **Continuous Learning Loop**: When a human reviewer confirms or overrides a decision, Sentinel persists an **override memory** with high weight back into Hindsight.
4. **Agentic Reflection**: Sentinel uses `hindsight.reflect()` to autonomously synthesize recurring organizational patterns (e.g. devDependency policies, compensating VPN controls).
5. **Multi-Tenant Isolation**: Memories are strictly partitioned into tenant-specific banks (`security-triage-${org.memoryBankId}`) guaranteeing zero cross-tenant leakage.
6. **Poisoning Safeguards**: Built-in safeguards detect anomalous or contradictory overrides to defend against memory poisoning attacks.

---

## 📊 Evaluation & Benchmark (+80 Pts Accuracy Lift)

Sentinel includes a 10-finding labeled evaluation set measuring triage accuracy **With Memory (Hindsight ON)** vs **Without Memory (Hindsight OFF)**:

| Metric | Memory OFF (Vanilla LLM) | Memory ON (Hindsight) | Lift |
|---|:---:|:---:|:---:|
| **Decision Accuracy** | **20.0%** | **100.0%** | **+80.0 pts** |
| **False Positive Detection** | Low (over-flags test mocks) | 100% (recalls allow-lists & dev fixtures) | **Dramatic noise reduction** |

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for local Postgres)
- Hindsight Cloud API Key ([ui.hindsight.vectorize.io](https://ui.hindsight.vectorize.io))
- Groq API Key ([console.groq.com](https://console.groq.com))

### 1. Clone & Install
```bash
git clone https://github.com/your-username/ai-security-triage-agent.git
cd ai-security-triage-agent
npm install
```

### 2. Environment Configuration
Create `.env.local`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"

# Hindsight Cloud
HINDSIGHT_BASE_URL="https://api.hindsight.vectorize.io"
HINDSIGHT_API_KEY="your-hindsight-api-key"

# Groq LLM
GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="openai/gpt-oss-120b"
```

### 3. Start Database & Dev Server
```bash
# Start PostgreSQL
docker-compose up -d

# Start Next.js development server
npm run dev
```

### 4. Sync Initial Memories to Hindsight
Open another terminal and trigger the initial memory bank synchronization:
```bash
curl -X POST http://localhost:3000/api/memory/sync
```

Visit **http://localhost:3000** to explore the interactive dashboard!

---

## 🖥️ Application Features

- **Queue (`/`)**: Real-time triage inbox with instant AI assessment, memory citations, and one-click human sign-off.
- **Accuracy Dashboard (`/accuracy`)**: Live benchmark comparison displaying Memory ON vs Memory OFF performance side-by-side with interactive charts.
- **Memory Alerts (`/alerts`)**: Safeguards against anomalous overrides and potential memory poisoning signals.
- **Org Settings (`/settings`)**: Multi-tenant bank configuration and autonomous reflection summarization.

---

## 🛡️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Memory Engine**: `@vectorize-io/hindsight-client` + Hindsight Cloud
- **LLM**: Groq Cloud (`openai/gpt-oss-120b`)
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS & Recharts
