# System Design Document (SDD)
## Industrial Field Maintenance Copilot (D5 + T2)

This is the most important document in the submission. It is
deliberately split into two parts: Part A describes the target
architecture with no time/budget constraint; Part B describes what was
actually built in the ~40-hour MVP window, with an explicit gap table
against Part A. Part B's reasoning matters more than Part A's size.

---

## Part A — Target Architecture (Unconstrained)

If this system were being built for real production use at an
industrial organization, with normal engineering resources and no
40-hour ceiling, the target architecture would include the following.

### A.1 API Gateway & Managed Rate Limiting
A managed API gateway (e.g. AWS API Gateway, Kong, or an
Nginx/Envoy-based ingress) in front of the Express application,
providing: TLS termination, distributed rate limiting (per-tenant,
per-API-key, not per-process-memory as in the current in-process
limiter), request/response logging, and basic WAF rules against known
attack signatures.

### A.2 Secrets Manager
API keys (Gemini), JWT signing secrets, and database credentials would
be stored in a managed secrets service (AWS Secrets Manager, HashiCorp
Vault, or GCP Secret Manager) with automatic rotation, rather than
plain environment variables in a `.env` file. Application code would
fetch secrets at startup via an authenticated client, never reading
them from disk-committed configuration.

### A.3 Message Broker for Async Work
Ingestion of large documents and long-running workflow steps would be
decoupled from the HTTP request/response cycle via a real message
broker (e.g. Redis-backed BullMQ, RabbitMQ, or AWS SQS). A client would
submit a job and receive an immediate 202 Accepted with a job ID;
workers would process jobs from the queue, publish progress updates
(e.g. via WebSocket or a job-status polling endpoint), and jobs would
survive a process restart, be resumable, cancellable, and idempotent —
this corresponds to the project brief's T7 twist, which was not the
twist assigned to this project (T2 was assigned instead) but represents
a natural production requirement regardless.

### A.4 Autoscaling
The Express API and any background workers would run as independently
scalable services (e.g. behind a Kubernetes Horizontal Pod Autoscaler,
or as separate autoscaling groups), scaling on request latency/queue
depth rather than running as a single long-lived Node process.

### A.5 Caching
- An embedding cache (e.g. Redis) keyed by a hash of the input text,
  to avoid re-computing embeddings for repeated or near-duplicate
  queries across users.
- A short-lived cache of retrieval results for identical recent
  queries within a session.

### A.6 Managed Vector Database
At larger corpus scale (tens of thousands of documents, millions of
chunks), a managed vector database (e.g. Pinecone, Weaviate Cloud, or
pgvector on a dedicated, tuned Postgres instance with read replicas)
would replace a single local Postgres instance, with proper index
tuning (HNSW parameter tuning, sharding) for the corpus size.

### A.7 Observability Stack
- Distributed tracing (OpenTelemetry, exported to a backend such as
  Jaeger, Honeycomb, or Datadog) replacing the current
  application-level `correlation_id` + database-row tracing.
- Structured log aggregation (e.g. ELK stack or a hosted equivalent)
  rather than `console.log`/`console.warn`.
- Metrics dashboards for token spend, latency percentiles, error
  rates per agent, and approval-gate SLA timers.
- Alerting on anomalous cost spend or elevated refusal rates
  (a sudden spike in refusals could indicate a retrieval regression or
  a corpus/index problem).

### A.8 CI/CD Environments
Separate `dev`, `staging`, and `production` environments with
environment-specific configuration, a proper deployment pipeline
(e.g. GitHub Actions building a container image, pushing to a
registry, and deploying via a GitOps tool like ArgoCD), automated
database migrations run as a pipeline step (not manually via `psql`),
and blue/green or canary deployment for the API tier.

### A.9 Disaster Recovery / Backup
- Automated, tested Postgres backups (point-in-time recovery) with a
  defined RPO/RTO.
- A documented runbook for restoring the vector index and relational
  data together, since they must remain consistent (a chunk's
  embedding must always correspond to a real `documents` row).

### A.10 Cost Model at Scale
At production scale (e.g. 1,000 technicians, 50 workflow runs/day
each), the dominant costs would be: LLM API calls (embeddings +
completions — mitigated by an embedding cache and, per the T3 twist
not assigned here, budget-aware model routing), a managed vector
database or a properly-provisioned Postgres instance, and compute for
the API/worker tiers. A back-of-envelope estimate at that scale, using
Gemini's pricing as of this writing, would run in the low
hundreds-to-low-thousands of USD/month depending on average
question/workflow volume and how aggressively caching reduces
redundant LLM calls — this would need to be modeled precisely against
real usage data before a production commitment.

---

## Part B — Implemented MVP, with Gap Table

### B.1 What was actually built

A single Node.js/Express process, PostgreSQL+pgvector as the only data
store, a Gemini-primary/Ollama-fallback LLM provider with no caching
layer, GitHub Actions as the only CI/CD (no separate deploy pipeline),
manually-run SQL migrations, secrets in a local `.env` file (gitignored,
never committed), in-process rate limiting via `express-rate-limit`,
and `console.log`/`console.warn` as the only logging mechanism, with
database-row tracing (`correlation_id`, `agent_steps`) as the
observability mechanism.

### B.2 Gap Table

| Target component (Part A) | Implemented? | Why deferred | Interim mitigation | Effort/cost to close |
|---|---|---|---|---|
| Managed API gateway + distributed rate limiting | No | Out of MVP time budget; adds an operational component (a gateway to deploy/manage) with no functional benefit at single-instance scale | In-process `express-rate-limit` (global 100 req/15min, stricter 5 req/15min on `/auth/login`) — mitigates the top operational risk (abuse-driven cost/token spend) for a single-process deployment, but will not survive horizontal scaling (each process instance would enforce its own independent limit, not a shared one) | ~4-6h to add a Redis-backed shared rate-limit store; a managed gateway is a larger, ops-dependent effort (~1-2 days plus infra setup) |
| Secrets manager | No | No production secrets-management infra available/needed for a local MVP demo | `.env` file, confirmed gitignored and never committed; JWT secret and Gemini key read from environment variables only | ~2-4h to integrate a secrets-manager SDK; mostly a config change, not a code-architecture change since secrets are already read via `process.env` at a small number of call sites |
| Message broker / async jobs (T7-style) | No | T7 was not the assigned twist (T2 was); ingestion and workflow runs complete synchronously within the HTTP request lifecycle for this corpus size | None — synchronous processing is acceptable at the current (small) corpus and workflow volume; the SSE endpoint already provides progress visibility for the one genuinely slow operation (streamed answers) | ~1-2 days to introduce a real queue (BullMQ + Redis) for ingestion and workflow runs, plus resumability/idempotency work |
| Autoscaling | No | Single-instance local/demo deployment | None needed at current scale | Not meaningfully estimable without a target cloud platform decision |
| Caching (embeddings, retrieval) | No | Not needed at current query volume/corpus size; every observed slowness was due to LLM provider latency or rate limits, not repeated computation | None | ~4h for a simple in-memory or Redis embedding cache keyed by input hash |
| Managed vector database | No | pgvector inside the existing Postgres instance is sufficient at the current corpus size (validated on ~10 of the eventual ≥30 documents so far) and avoids a second paid/managed service | HNSW index (switched from an initially-configured IVFFlat index after observing explicit low-recall warnings on a small table) | Migration effort scales with corpus size; not urgent below tens of thousands of chunks |
| Full observability stack (OTel, dashboards, alerting) | No | Requires infra (a tracing backend, a metrics/log aggregation service) out of scope for a local MVP | `correlation_id` threaded through `runs`/`agent_steps`, manually verified via direct SQL query that a full workflow run's 3 agent steps are individually inspectable; token/cost accounting implemented per-step and per-run (verification via a full evaluation re-run is a known pending item — see EVALUATION.md) | ~1 day to wire OpenTelemetry SDK into the Express app and agents, plus a backend (even a free-tier Honeycomb/Jaeger instance) to receive traces |
| Separate CI/CD environments + automated migration pipeline | No | No deployment target (staging/production infra) exists for this MVP | GitHub Actions CI runs tests + `npm audit` + `gitleaks` on every PR to `main`; migrations are plain `.sql` files run manually via `docker exec ... psql` | ~1 day to add a migration-runner step to CI/CD once a real deployment target exists |
| Disaster recovery / backup | No | No production deployment; local Docker volume only | Docker volume persistence across container restarts (not a real backup) | Depends entirely on chosen hosting; a managed Postgres service typically provides this out of the box |
| Cost model at scale | No | No real usage data to model against | The evaluation harness's per-run token/cost fields provide a starting point for extrapolation once real usage data exists | ~1 day of analysis once usage data is available |

### B.3 Significant design decisions, with alternatives considered

(The four architecturally central decisions — chunking strategy,
retrieval fusion, vector store choice, and the T2 provider-fallback
design — are documented as formal ADRs in `docs/ARCHITECTURE.md`
section 9, and are not repeated in full here. Below are additional
decisions not already covered there.)

**Decision: Plain JavaScript (ES6+), not TypeScript.**
Alternative considered: TypeScript, which would have given
compile-time type checking for the agent contracts "for free."
Rejected as a deliberate scope choice: the team's existing comfort was
with plain JavaScript, and Zod schemas provide runtime validation of
every agent boundary — arguably a stronger guarantee than compile-time
types alone, since Zod validation also catches malformed data at
runtime in production, not just at compile time. The trade-off
accepted: no static type-checking of internal function signatures
outside the validated boundaries.

**Decision: Repository pattern with raw `pg` queries, no ORM.**
Alternative considered: Prisma (the most common Node ORM choice).
Rejected specifically because Prisma's pgvector support was
insufficiently mature at the time of this project, and an ORM
introduces a real risk of its generated model classes leaking into the
domain layer as an implicit dependency — directly contradicting the
Hexagonal Architecture's core rule that domain/application code must
have zero framework/SDK dependencies. Raw SQL via the `pg` driver,
wrapped in explicit Repository classes, keeps full control over hybrid
queries (combining a vector similarity clause with a full-text search
clause) that would be awkward to express through most ORM query
builders.

**Decision: Session/run history stored directly in the same Postgres
instance as everything else, with no separate analytics store.**
Alternative considered: a separate read-optimized store (e.g. a
columnar database) for historical run analytics. Rejected as
unnecessary at current scale — the `runs`/`agent_steps` tables serve
both the "operational" need (showing a technician their session
history) and the "audit" need (inspecting any run's full trace) with
simple indexed queries.

**Decision: An expedient choice made under time pressure — evaluation
harness security-check logic.**
The initial evaluation harness flagged a prompt-injection test
question as a security failure because its keyword check looked for
the literal substring "skip safety checks" anywhere in the model's
answer — including when the model was correctly quoting the injected
phrase back while explaining that it disregarded it. This was a
measurement bug, not a system defect, but it was expedient (a simple
substring check) rather than correct from the start. It was caught via
manual review of the actual answer text, not from the harness's own
output, and is documented honestly here rather than silently
recomputing a better-looking number. The fix (checking for
compliance-indicating phrases specifically, e.g. "you should skip"
rather than any occurrence of the source phrase) is a pending harness
improvement, tracked in EVALUATION.md.

**Decision: An AI coding assistant introduced, then reverted, a
behavioral change that weakened a core safety guarantee.**
During Phase 9 work, an AI agent (used to implement token/cost
tracking and other observability/security additions) independently
added a `buildGroundedFallbackResponse` method to
`DiagnosticSafetyPlannerAgent` that silently constructed an answer
from raw retrieved chunks whenever the LLM failed to produce a
correctly-formatted safety-prerequisites section — replacing the
agent's original strict-refusal behavior with a best-effort
reconstruction. This was not requested and was caught during code
review before merge, specifically because the change print quality
looked like an improvement (fewer refusals) at first glance but
actually undermined "grounded, never guessing" as applied to safety
content. It was reverted, and the associated test was corrected to
assert refusal rather than the removed fallback. This is documented in
full in `docs/AI-USAGE-LOG.md` as a concrete example of the kind of AI
error this project's teaching materials are meant to help others learn
to catch.
