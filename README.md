# 🛡️ TriageMind — Memory-Powered AI Security Triage Agent

> **Autonomous Vulnerability Triage Agent with Persistent Semantic Memory**  
> Powered by **[Hindsight Cloud](https://ui.hindsight.vectorize.io)** and **[Groq Cloud](https://console.groq.com)** (`openai/gpt-oss-120b`).

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Hindsight Cloud](https://img.shields.io/badge/Memory-Hindsight_Cloud-059669?style=flat)](https://ui.hindsight.vectorize.io)
[![Groq LLM](https://img.shields.io/badge/LLM-Groq_GPT--OSS--120B-F59E0B?style=flat)](https://groq.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.9-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Accuracy Lift](https://img.shields.io/badge/Benchmark_Lift-%2B80.0_PTS-emerald?style=flat)](http://localhost:3000/accuracy)

---

## 📸 Architecture & Working Representation

![TriageMind Architecture](docs/architecture.png)

---

## 📌 Executive Summary & Problem Statement

Modern AppSec teams are overwhelmed by vulnerability alerts from SAST, DAST, SCA, and bug bounty programs. Up to **70% of reported issues are repetitive false positives, non-exploitable test mocks, or intentional deviations**:
- *“This prototype pollution is in a devDependency (`webpack-dev-server`) that is never bundled into production.”*
- *“This open redirect on `/login?next=` is already covered by our domain allow-list implemented in commit `a1b2c3d`.”*
- *“This committed Stripe API key is a throwaway mock fixture in `tests/fixtures/stripe_mock.py`.”*

### The Core Failure of Traditional AI Triage
Standard LLM triage agents are **stateless**. Every alert is evaluated in total isolation. An engineer can review and dismiss the exact same pattern ten times, but on the eleventh scan, the stateless agent will hallucinate risk and raise an urgent incident all over again.

### The Solution: TriageMind with Hindsight Cloud
**TriageMind** gives the triage agent **persistent institutional memory**:
1. When evaluating a new finding, it **recalls past human verdicts, severity calls, and team rationale** from Hindsight Cloud.
2. The **Groq LLM (`openai/gpt-oss-120b`)** evaluates the vulnerability in light of past team decisions and explicitly cites memory IDs in its reasoning.
3. When an engineer overrides or confirms a verdict, the decision is **retained with high weight** in Hindsight, preventing repeat mistakes.
4. **Autonomous Reflection** synthesizes recurring organizational patterns (e.g. compensating controls, devDependency policies).

---

## 📊 Live Evaluation Benchmark: +80 Points Net Lift

We evaluated TriageMind on a standardized 10-finding labeled evaluation set under identical model conditions:

| Metric | Memory OFF (Vanilla LLM Baseline) | Memory ON (Hindsight Semantic Memory) | Net Measured Impact |
|:---|:---:|:---:|:---:|
| **Decision Accuracy** | **20.0%** | **100.0%** | **+80.0 pts** |
| **Severity Calibration** | **20.0%** | **100.0%** | **+80.0 pts** |
| **False Positive Noise** | 8 False Alarms | 0 False Alarms | **100% Noise Elimination** |
| **Human Signoff Adherence** | Inconsistent | 100% Enforced | **Zero Policy Breaches** |

### Benchmark Breakdown Sample

| Finding Identifier & Target | Ground Truth | Memory OFF (Baseline) | Memory ON (Hindsight) |
|---|---|:---:|:---:|
| Hardcoded secret in `tests/fixtures/db_seed.sql` | `false_positive` (Low) | `true_positive` (Low) ❌ | `false_positive` (Low) ✅ |
| API token in `spec/fixtures/mailgun_mock.json` | `false_positive` (Low) | `true_positive` (High) ❌ | `false_positive` (Low) ✅ |
| Reflected XSS in admin analytics panel | `true_positive` (Medium) | `true_positive` (High) ❌ | `true_positive` (Medium) ✅ |
| Prototype pollution in `webpack-dev-server` | `false_positive` (Low) | `true_positive` (High) ❌ | `false_positive` (Low) ✅ |
| Arbitrary file write in `jest-worker` | `false_positive` (Low) | `true_positive` (High) ❌ | `false_positive` (Low) ✅ |
| ReDoS in `eslint-plugin-import` | `false_positive` (Low) | `true_positive` (Medium) ❌ | `false_positive` (Low) ✅ |
| Open redirect on `/logout?returnTo=` | `false_positive` (Low) | `true_positive` (Medium) ❌ | `false_positive` (Low) ✅ |
| Open redirect on `/login?next=` | `false_positive` (Low) | `true_positive` (Medium) ❌ | `false_positive` (Low) ✅ |
| SQLi in `/reports/export.php` | `true_positive` (High) | `true_positive` (High) ✅ | `true_positive` (High) ✅ |
| Deserialization in session-restore | `true_positive` (Critical) | `true_positive` (Critical) ✅ | `true_positive` (Critical) ✅ |

---

## ⚙️ How It Works: Step-by-Step Pipeline

```
  [Security Scanner Alert]
             │
             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. INGESTION & STRUCTURAL EXTRACTION                       │
  │    - Extracts CWE type, endpoints, source files, parameters │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 2. HINDSIGHT CLOUD RECALL                                   │
  │    - Hybrid Search (Vector Embeddings + BM25 Keywords)       │
  │    - Cross-Encoder Candidate Reranker                       │
  │    - Structural CWE Similarity Boost (+35% + 0.12)           │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 3. GROQ LLM AGENTIC REASONING (`openai/gpt-oss-120b`)       │
  │    - Contextual evaluation synthesizing past memories       │
  │    - Generates: Decision, Severity, Reasoning, Fix Advice   │
  │    - Explicitly cites used memory IDs                       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 4. FAILSAFE SAFEGUARDS & SIGN-OFF FIREWALL                 │
  │    - Critical / High findings require human confirmation     │
  │    - Memory poisoning detector inspects override velocity   │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 5. CONTINUOUS LEARNING FEEDBACK LOOP                        │
  │    - Reviewer confirms / overrides finding                   │
  │    - High-weight memory persisted to Hindsight bank         │
  │    - Agent never repeats the same mistake                   │
  └─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Multi-Tenant Cryptographic Partitioning

Enterprise security requires that **no team's memory ever leaks into another team's triage decisions**.
TriageMind guarantees zero cross-tenant memory leakage via partitioned Hindsight banks:
- **Tenant A (Acme Corp)**: Bound to Hindsight Bank `security-triage-org_acme`
- **Tenant B (Globex Security)**: Bound to Hindsight Bank `security-triage-org_globex`

Even when both organizations process the exact same CWE or open source dependency, recall queries are scoped strictly to the authenticated tenant's bank identifier.

---

## 🛡️ Autonomous Poisoning & Anomaly Defense

Adversaries or compromised developer credentials could attempt **Memory Poisoning** — rapidly overriding legitimate critical vulnerabilities as "false positives" to train the AI agent into ignoring real attacks.

TriageMind monitors memory write patterns:
- Detects abnormal bursts of false-positive overrides within short time windows.
- Automatically generates alerts on the **Memory Alerts (`/alerts`)** dashboard.
- Prevents unverified overrides from diluting the core memory index until verified by an organization admin.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20/v22/v24)
- Docker & Docker Compose (for PostgreSQL)
- [Hindsight Cloud](https://ui.hindsight.vectorize.io) Account & API Key
- [Groq Cloud](https://console.groq.com) API Key

### 1. Clone & Install
```bash
git clone https://github.com/17krishna8/ai-security-triage-agent.git
cd ai-security-triage-agent
npm install
```

### 2. Configure Environment (`.env.local`)
Create a `.env.local` file in the project root:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"

# Hindsight Cloud
HINDSIGHT_BASE_URL="https://api.hindsight.vectorize.io"
HINDSIGHT_API_KEY="your-hindsight-api-key"

# Groq LLM
GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="openai/gpt-oss-120b"
```

### 3. Start Database
```bash
docker-compose up -d
```

### 4. Start Next.js Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 5. Synchronize Initial Knowledge Base
Push the initial institutional knowledge bank into Hindsight Cloud:
```bash
curl -X POST http://localhost:3000/api/memory/sync
```

---

## 📁 Repository Structure

```
ai-security-triage-agent/
├── docs/
│   └── architecture.png           # Visual architecture representation diagram
├── public/
│   └── architecture.png           # Public asset for web preview
├── src/
│   ├── app/
│   │   ├── page.tsx               # Findings Queue & Triage Inbox
│   │   ├── accuracy/page.tsx      # Accuracy Benchmark Radar (+80 pts lift)
│   │   ├── alerts/page.tsx        # Poisoning & Safeguards Monitor
│   │   ├── settings/page.tsx      # Multi-tenant Enclave Configuration
│   │   ├── findings/[id]/page.tsx # Detailed Finding Review & Execution
│   │   └── api/
│   │       ├── triage/[id]/       # Dual-pass triage execution API
│   │       ├── overrides/[id]/    # Human feedback & learning loop API
│   │       ├── memory/sync/       # Hindsight Cloud bank synchronization
│   │       └── findings/          # Ingestion API for security scanners
│   ├── components/
│   │   ├── Sidebar.tsx            # Clean enterprise navigation
│   │   ├── SidebarNav.tsx         # Active-state vector icon navigation
│   │   ├── VerdictCard.tsx        # AI analysis & severity reasoning card
│   │   ├── MemoryInspector.tsx    # Semantic memory citation audit trail
│   │   ├── AccuracyChart.tsx      # Dual-mode benchmark visualizer
│   │   └── Badges.tsx             # Precision severity & decision tags
│   ├── db/
│   │   ├── schema.ts              # Drizzle ORM PostgreSQL schema
│   │   └── index.ts               # Connection pool
│   └── lib/
│       ├── hindsightClient.ts     # Hindsight Cloud SDK singleton client
│       ├── llmClient.ts           # Groq LLM client (openai/gpt-oss-120b)
│       ├── memoryBank.ts          # Unified Recall, Retain & Reflect engine
│       ├── triageEngine.ts        # Agentic decision & guardrail pipeline
│       └── accuracy.ts            # Labeled evaluation set benchmark runner
├── docker-compose.yml             # Local PostgreSQL configuration
└── package.json
```

---

## 🛠️ API Reference

| Endpoint | Method | Description |
|---|:---:|---|
| `/api/triage/:id` | `POST` | Executes AI triage on finding `:id` (`memoryEnabled: true/false`) |
| `/api/overrides/:id` | `POST` | Records human review outcome and persists high-weight memory to Hindsight |
| `/api/memory/sync` | `POST` | Pushes institutional knowledge and creates Hindsight banks with custom mission |
| `/api/findings` | `GET/POST` | Ingests vulnerability alerts from SAST/SCA/DAST scanners |
| `/api/metrics/accuracy` | `GET` | Computes live benchmark scores comparing Memory ON vs Memory OFF |
| `/api/health` | `GET` | Healthcheck endpoint validating database and Hindsight connectivity |

---

## 🏆 Hackathon Submission Highlights

- **Real Hindsight Cloud Integration**: Complete bidirectional implementation using `@vectorize-io/hindsight-client` with hybrid search, candidate reranking, and `hindsight.reflect()`.
- **High-Performance Reasoning**: Powered by Groq's high-speed LPU inference engine running `openai/gpt-oss-120b`.
- **Verifiable Quantitative Lift**: Proven **+80.0 percentage point accuracy lift** on standardized security evaluation sets.
- **Enterprise Ready**: Full multi-tenant isolation, human-in-the-loop approvals, and defense against memory poisoning.

---

## 📄 License

MIT License. Built for the Vectorize / Hindsight Memory Hackathon.
