# How We Built TriageMind: Slashing AppSec Alert Fatigue with Memory-Augmented AI Agents

> *Why stateless LLMs fail at vulnerability triage, and how persistent memory with Hindsight and Groq delivered an 80-point accuracy leap.*

---

![TriageMind Architecture Banner](https://raw.githubusercontent.com/17krishna8/ai-security-triage-agent/main/docs/linkedin_banner.jpg)

## The Hidden Crisis in Application Security

Ask any Application Security (AppSec) engineer about their daily routine, and you will hear a universal complaint: **alert fatigue**.

Modern continuous integration pipelines are flooded with findings from Static Application Security Testing (SAST), Dynamic Analysis (DAST), and Software Composition Analysis (SCA) scanners. In enterprise environments, **more than 70% of reported findings are non-actionable false positives**:

- Hardcoded "secret keys" that are actually test fixtures inside mock test suites.
- "Vulnerable" dependencies restricted exclusively to internal build tooling.
- Potential Server-Side Request Forgery (SSRF) endpoints protected by strict internal subnet allowlists.

Security teams spend hundreds of hours every quarter reviewing the exact same patterns, approving the exact same exceptions, and marking the exact same false positives.

When teams attempt to automate this triage with conventional Large Language Models (LLMs), they quickly encounter a fundamental limitation: **statelessness**. A generic LLM evaluates every vulnerability in total isolation. It does not know that two weeks ago a staff security engineer established that `api_key_test_sandbox_123` is a benign mock. It has no institutional memory. Every security scan is Day Zero all over again.

To break this cycle, we built **TriageMind**: an open-source, memory-augmented security triage agent that actively learns from every human engineer decision using **Vectorize Hindsight Cloud** and **Groq LPU inference**.

---

## The Solution Architecture: An Agent That Learns

TriageMind replaces rigid regex rules and forgetful chatbots with a continuous 4-step learning loop:

```
    [ SAST / DAST Vulnerability Alert ]
                    │
                    ▼
     ┌──────────────────────────────┐
     │ 1. INGEST & CONTEXT EXTRACTION│
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │ 2. HINDSIGHT MEMORY RECALL   │ ◄─── Prior Team Decisions & Whitelists
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │ 3. GROQ LPU LLM REASONING    │ (Fast Exploitability & Rationale)
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │ 4. HUMAN REVIEW & RETENTION  │ ───► Persistent Memory Bank Update
     └──────────────────────────────┘
```

### The 4-Step Triaging Pipeline

1. **Ingest**: The agent ingests raw vulnerability data (scanner output, CWE/CVE identifiers, file paths, repository context, and surrounding source code).
2. **Recall**: Before invoking the reasoning model, TriageMind queries **Hindsight Cloud** to retrieve relevant organizational policies, historical human overrides, and past triage rationales.
3. **Decide**: The prompt—rich in both code context and institutional memory—is evaluated via **Groq** using `openai/gpt-oss-120b`. The model outputs a structured JSON verdict (`true_positive`, `false_positive`, `needs_human_review`), severity score, and detailed rationale citing retrieved memories.
4. **Learn (Retain)**: When a human security engineer reviews or overrides a verdict, TriageMind immediately calls Hindsight’s `retain()` endpoint. The human decision becomes a persistent memory node, instantly calibrating all future scans across every repository.

---

## Under the Hood: Why Hindsight Makes the Difference

Most AI applications attempt memory by stuffing full conversation histories into vector databases (RAG). In security operations, naive RAG fails because:
- It treats all context equally (a junior developer's note is weighted the same as a Principal CISO policy).
- It lacks semantic reflection and dispositioning.
- It is vulnerable to prompt injections and context poisoning.

TriageMind leverages Hindsight’s native memory primitives to create an enterprise-ready memory fabric:

### 1. The Triad of Memory Primitives
- **`recall(bankId, query, { budget: 'high' })`**: Pulls high-relevance memories matching the finding's file pattern, vulnerability category, and code semantics.
- **`retain(bankId, content, { metadata, context })`**: Captures human overrides with author provenance, confidence weighting, and contextual tags.
- **`reflect(bankId, query)`**: Synthesizes cross-cutting security policies across hundreds of individual triage actions.

### 2. Multi-Tenant Cryptographic Isolation
Enterprises cannot allow internal vulnerability exceptions to bleed across organizations. TriageMind partitions memories at the foundational level:

$$\text{Bank ID} = \text{security-triage-}\langle\text{org.memoryBankId}\rangle$$

Acme Corp’s proprietary microservice exemptions are isolated cryptographically from Globex Corp’s memory bank.

### 3. Safeguards Against Memory Poisoning
If an attacker could trick an AI triage agent into remembering that *"all SQL queries are safe"*, they could bypass security reviews entirely. TriageMind introduces real-time **Memory Poisoning Detection**:
- Tracks high-velocity verdict flipping.
- Flags anomalous downgrade attempts (e.g., Critical $\to$ False Positive without valid rationale).
- Alerts security leads before polluted context can propagate through the memory bank.

---

## Empirical Benchmark: The +80.0 Point Accuracy Leap

To measure the real-world impact of persistent memory, we constructed a 10-finding labeled evaluation set covering common AppSec edge cases:
- Mock secrets in test suites.
- Deserialization in sandboxed workers.
- SSRF behind internal egress proxies.
- Authenticated IDOR vulnerabilities.
- Production credential leaks.

We benchmarked TriageMind in two configurations: **Cold Start (Memory Disabled)** vs. **TriageMind (Memory Enabled)**.

| Evaluation Metric | Memory OFF (Baseline) | Memory ON (TriageMind) | Net Impact |
| :--- | :---: | :---: | :---: |
| **Overall Triage Accuracy** | **20.0%** (2 / 10) | **100.0%** (10 / 10) | **+80.0 pts** 🚀 |
| **False Positive Noise Ratio** | 80.0% unhandled | 0.0% unhandled | **-80.0 pts** |
| **Policy Hallucinations** | Frequent | 0 (Grounded in Memory) | Eliminated |
| **Mean Triage Latency (Groq)** | ~1.4s | ~1.8s (incl. memory recall) | Real-time CI/CD capable |

![Accuracy Benchmark Comparison](https://raw.githubusercontent.com/17krishna8/ai-security-triage-agent/main/docs/architecture.png)

### Why Memory OFF Fails
Without memory, the LLM flags every test secret (`test_stripe_sk_live_mock_12345`) as a Critical incident, ignores repository-specific architectural safeguards, and forces humans to review the same benign lines of code perpetually.

### Why Memory ON Wins
With Hindsight, the agent immediately cites prior decisions:
> *"Recalled Memory #mem_042: Acme Corp policy permits simulated API tokens under `/tests/fixtures`. Classified as False Positive. Action: Auto-resolved."*

---

## Key Takeaways for AI Agent Builders

Building TriageMind revealed three fundamental truths about the next generation of AI agents:

1. **Stateless AI is Incomplete**: LLMs provide reasoning engines, but without memory, they cannot accumulate domain expertise. Memory transforms an AI from a generic assistant into a specialized team member.
2. **Inference Speed Determines Utility**: In DevOps and AppSec, security gates cannot block developers for 30 seconds per commit. Groq’s LPU inference enables deep reasoning in sub-2-second intervals, making real-time pull request analysis viable.
3. **The Human-in-the-Loop Flywheel**: The most effective AI systems do not attempt to replace domain experts; they make every human decision compound in value. Every override an engineer makes in TriageMind makes the entire organization smarter forever.

---

## Explore the Project

TriageMind is completely open-source:

- **GitHub Repository**: [17krishna8/ai-security-triage-agent](https://github.com/17krishna8/ai-security-triage-agent)
- **Built With**: Vectorize Hindsight Cloud, Groq LPU, Next.js, and Drizzle ORM.
- **Category**: Engineering & DevOps / Incident Response Agent (Hindsight Hackathon).

*If you are an AppSec engineer, DevOps lead, or AI agent builder, we would love your thoughts and feedback! Give the project a star on GitHub and try spinning it up on your own repositories.*
