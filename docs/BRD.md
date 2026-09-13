# Business Requirements Document (BRD)
## Industrial Field Maintenance Copilot (Variant D5 + T2)

---

## 1. Context

An organization holding a large body of specialized industrial equipment
maintenance manuals needs its field technicians and supervisors to
resolve equipment issues faster and more safely. Today, technicians
manually search paper/PDF manuals to diagnose symptoms, identify the
correct manual version for their specific equipment, and determine
safety prerequisites before performing work — a slow, error-prone
process where using the wrong manual version or missing a safety step
can cause injury or equipment damage.

This project builds a Copilot that (1) answers technician questions
about equipment manuals with verifiable citations, and (2) runs a
structured, multi-agent diagnostic workflow that identifies equipment,
retrieves version-correct diagnostic and safety information, and
drafts a work order — which a human supervisor must approve before it
is considered final.

### Variant assignment
- **Domain Pack: D5 — Industrial / Field Maintenance**
- **Twist: T2 — Offline / Degraded Mode**
- Derivation: Domain = (last two digits of National ID) mod 7 = 5;
  Twist = (sum of all digits of National ID) mod 8 = 2. (National ID
  itself is not recorded in this document per data-handling policy.)

---

## 2. Personas

| Persona | Role | Needs |
|---|---|---|
| **Technician** | Front-line worker responding to an equipment symptom | Fast, grounded answers to manual questions; a guided diagnostic workflow that identifies the right equipment/manual version and produces a draft work order |
| **Supervisor** | Reviews and authorizes work | Must approve, reject, or edit-and-approve any proposed work order before it is considered actionable; needs visibility into why an answer or workflow step reached its conclusion |

---

## 3. Objectives (with measurable criteria)

| ID | Objective | Measurable criterion |
|---|---|---|
| OBJ-1 | Answers are grounded in the ingested corpus, never fabricated | ≥90% refusal correctness on the evaluation golden set (achieved: 92% in the best-observed online/mixed run) |
| OBJ-2 | Retrieval finds relevant source material reliably | ≥95% retrieval hit-rate on the golden set (achieved: 100% in the best-observed run) |
| OBJ-3 | The system functions without internet access (T2) | A full workflow run (ingestion, retrieval, and generation) completes successfully with the network disconnected, using local models only, with capability differences honestly documented |
| OBJ-4 | No work order is dispatched without human authorization | 100% of proposed work orders are persisted with status `pending` in `approvals` and never receive a `work_orders` row until a `DecideApproval` call with an explicit decision occurs |
| OBJ-5 | Safety prerequisites can never be silently skipped | Structural enforcement at 3 independent layers (Zod schema, agent logic, `WorkOrder` domain entity) verified by unit tests |
| OBJ-6 | The system resists prompt injection embedded in source documents | 100% of adversarial prompt-injection golden-set questions correctly disregard the injected instruction (verified; an evaluation-harness measurement bug that produced a false failure on this metric was found and corrected) |

---

## 4. Requirements (uniquely identified, with acceptance criteria)

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| BR-01 | Ingest documents in ≥2 formats | TXT and PDF both ingest successfully with per-document status tracking | Implemented |
| BR-02 | Idempotent re-ingestion | Re-ingesting an unchanged file is skipped (`skipped_duplicate`), verified via SHA-256 content hash | Implemented |
| BR-03 | Hybrid retrieval (dense + keyword) with documented fusion | Reciprocal Rank Fusion combines pgvector cosine similarity and PostgreSQL full-text search | Implemented |
| BR-04 | A documented retrieval enhancement | Metadata filtering (by `manualVersion`/`documentId`) implemented and used by the diagnostic agent to prevent cross-version contamination | Implemented |
| BR-05 | Every answer is citable to a specific chunk | Citations include document title, manual version, and section for every claim | Implemented |
| BR-06 | Correct refusal when evidence is insufficient | Literal refusal string checked programmatically in the evaluation harness | Implemented |
| BR-07 | A golden evaluation set with adversarial cases | 25 questions across 6 categories including out-of-corpus, prompt-injection (4 cases), and missing-information cases | Implemented |
| BR-08 | ≥3 specialized agents + orchestrator | SymptomMatcher, DiagnosticSafetyPlanner, WorkOrderGenerator + MaintenanceWorkflowOrchestrator | Implemented |
| BR-09 | Agents communicate via typed contracts | Zod schemas for every agent's input/output, safetyPrerequisites required non-empty at every hop | Implemented |
| BR-10 | ≥1 write/side-effecting tool gated by approval | Work order finalization only occurs via `DecideApproval`, never automatically | Implemented |
| BR-11 | Orchestration has resilience controls | Max-iteration breaker, per-step timeout, retry-with-backoff (transient errors only, not domain refusals) | Implemented |
| BR-12 | Every run is inspectable by ID | `correlation_id` traced through `runs`/`agent_steps`, verified via direct SQL query | Implemented |
| BR-13 | Streaming responses with live progress | SSE endpoint (`/ask/stream`) emits status, answer_chunk, done/error events | Implemented |
| BR-14 | Client cancellation | `req.on('close')` stops further writes on client disconnect; documented that true mid-stream LLM cancellation is not supported by the SDKs | Implemented (partial — documented limitation) |
| BR-15 | Documented HTTP API | `docs/openapi.yaml` (OpenAPI 3.0) covers all endpoints | Implemented |
| BR-16 | A minimal functional UI | React UI covering ingest, ask (streamed), workflow, approval gate, session history | In progress |
| BR-17 | Persistent session history | `sessions` table linked to `runs`, with list/detail endpoints | Implemented |
| BR-18 | Authentication + ≥2 roles, enforced server-side | JWT-based auth; `requireRole('supervisor')` middleware blocks approval decisions for technicians regardless of UI state | Implemented |
| BR-19 | Correlation ID + per-request token/cost accounting | Implemented through the orchestrator and `RunRepository`; end-to-end evaluation re-confirmation pending | Implemented (verification pending) |
| BR-20 | Rate limiting and security headers | `express-rate-limit` (global + stricter auth-specific limiter), `helmet`, explicit non-wildcard CORS | Implemented |
| BR-21 | Server-side input validation on all routes | Centralized Zod schemas + validation middleware across all 6 route groups | Implemented |
| BR-22 | No secrets/PII in logs | Audited; error messages sanitized to avoid leaking API keys | Implemented |
| BR-23 | Dependency and secret scanning in CI | `npm audit` and `gitleaks` added as a CI job | Implemented |
| BR-24 | Provider abstraction with fallback (T2 core) | Single `LLMProvider` interface; Gemini (hosted) and Ollama (local) adapters; automatic fallback verified with the network disconnected | Implemented |
| BR-25 | ≥30 document corpus, ≥150 pages | Corpus expansion in progress (10 documents validated as of this writing; expansion to 30 ongoing) | In progress |

---

## 5. Explicit out-of-scope

- Integration with any external CMMS/dispatch system — an approved
  work order's terminal state in this MVP is a persisted, auditable
  database record, not a message sent to an external system. (See
  SYSTEM-DESIGN.md Part A for the target-state integration.)
- File upload via the API — `/ingest` takes a server-side file path,
  not a multipart upload.
- True mid-stream cancellation of an in-flight LLM call — only
  further writes to a closed client connection are stopped.
- Multi-tenancy (T0) — not the assigned twist; a single-tenant
  deployment is assumed throughout.
- Fine-tuning or training of any model — both online (Gemini) and
  offline (Ollama) models are used off-the-shelf.
- A production-grade managed message broker for async jobs (T7) — not
  the assigned twist; not implemented.
- Enterprise security tooling (WAF, SIEM, managed secrets vault) —
  explicitly deferred to SYSTEM-DESIGN.md Part A as target-state,
  unconstrained architecture.

---

## 6. Business rules

- BR-RULE-1: A work order can never be constructed with an empty or
  missing `safetyPrerequisites` list, at any layer of the system.
- BR-RULE-2: Only a user with the `supervisor` role may approve,
  reject, or edit-and-approve a proposed work order.
- BR-RULE-3: `approvedBy` and `initiatedBy` on any run/approval are
  always derived from the authenticated user's verified JWT, never
  from client-supplied request data.
- BR-RULE-4: Retrieval for the diagnostic/safety planning step is
  always scoped to the specific manual version identified by the
  symptom-matching step; content from a different manual version for
  the same equipment must never be mixed in.
- BR-RULE-5: Text embedded within retrieved document content is always
  treated as data to cite from, never as an instruction to follow,
  regardless of its phrasing.

---

## 7. Assumptions

- The organization's technicians and supervisors have basic
  familiarity with a simple web form-based tool; no training beyond
  the provided teaching materials is assumed.
- The equipment identifier convention (`[A-Z]{1,4}-\d{2,4}`, e.g.
  "HP-200") is representative of the organization's real naming
  scheme; a real deployment would need this pattern reviewed against
  actual equipment tagging conventions.
- A single organizational tenant is sufficient for this MVP; no
  cross-organization data isolation is required (T0 was not the
  assigned twist).
- Document ingestion is performed by an authorized administrator via
  direct file path, not by end-user upload, for this MVP.
- Gemini's free-tier quota (as low as 5-20 requests per period,
  observed to fluctuate) is expected to be exhausted during ordinary
  development and evaluation use, which is precisely why the T2
  fallback to a local model is a functional requirement, not a nice-to-have.

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Local (offline) model produces meaningfully lower-quality answers than the hosted model | Observed, high | Medium — acceptable per T2's explicit brief, but must be honestly documented | Evaluation harness run in both online/mixed and full-offline conditions; gap (92%→52% refusal correctness in worst observed case) documented in EVALUATION.md with root-cause analysis |
| Small local model fails to follow exact output formatting, causing incorrect refusals | Observed | Medium | One-shot formatting retry added to DiagnosticSafetyPlannerAgent; documented as a known trade-off, not silently patched over with an unsafe fallback |
| An AI coding assistant introduces an undocumented behavioral change that weakens a safety guarantee | Observed once during this project (a fallback that bypassed strict refusal) | High if unnoticed | Caught via manual code review before merge, reverted, and documented in AI-USAGE-LOG.md as a concrete example of AI-introduced risk requiring human oversight |
| Inconsistent database state after repeated manual re-ingestion during development | Observed | Low-medium (development-time only) | Root-caused to stale `manual_version`/`equipment_id` values on documents ingested before certain fixes; resolved by a clean wipe-and-re-ingest; to be avoided going forward via the idempotent content-hash check |
| Gemini free-tier rate limits interrupt evaluation runs, making "online" results actually a Gemini/Ollama mix | Observed, high | Low (doesn't invalidate correctness, only labeling precision) | Explicitly disclosed in EVALUATION.md rather than mislabeling the run as a clean online-only baseline |

---

## 9. Traceability matrix

| Requirement | Implemented? | Evidence |
|---|---|---|
| BR-01 (multi-format ingestion) | Implemented | `TextExtractor.js`, `PdfExtractor.js`, `IngestDocument.js` dispatch logic |
| BR-02 (idempotent ingestion) | Implemented | `content_hash` column + `findByContentHash` check |
| BR-03 (hybrid retrieval) | Implemented | `VectorSearchRepository.js`, `hybridFusion.js` |
| BR-04 (retrieval enhancement) | Implemented | Metadata filtering in `VectorSearchRepository` search methods |
| BR-05 (citations) | Implemented | `buildPrompt.js` SOURCE tagging, `AskQuestion.js` citation extraction |
| BR-06 (refusal correctness) | Implemented | Literal refusal string + evaluation harness measurement |
| BR-07 (golden set) | Implemented | `evaluation/golden-set.json` (25 questions, 6 categories) |
| BR-08 (3 agents + orchestrator) | Implemented | `SymptomMatcherAgent.js`, `DiagnosticSafetyPlannerAgent.js`, `WorkOrderGeneratorAgent.js`, `MaintenanceWorkflowOrchestrator.js` |
| BR-09 (typed contracts) | Implemented | `agentSchemas.js` |
| BR-10 (approval-gated write) | Implemented | `DecideApproval.js`, `approvals`/`work_orders` tables |
| BR-11 (resilience controls) | Implemented | `resilience.js` (retry-with-backoff, timeout), max-iteration breaker in orchestrator |
| BR-12 (per-run tracing) | Implemented | `agent_steps` table, verified via direct SQL query during Phase 7 testing |
| BR-13 (streaming) | Implemented | `askStream.js`, `completeStream` on `LLMProvider` port |
| BR-14 (cancellation) | Partial | `req.on('close')` handling; underlying LLM call cancellation is a documented limitation |
| BR-15 (OpenAPI doc) | Implemented | `docs/openapi.yaml` |
| BR-16 (UI) | In progress | React frontend under active development |
| BR-17 (session history) | Implemented | `SessionRepository.js`, `/sessions` endpoints |
| BR-18 (auth + roles) | Implemented | `AuthenticateUser.js`, `requireAuth`/`requireRole` middleware |
| BR-19 (token/cost tracking) | Implemented, evaluation-verification pending | `providerConfig.js` cost lookup, `RunRepository` persistence |
| BR-20 (rate limiting/headers) | Implemented | `express-rate-limit`, `helmet`, explicit CORS |
| BR-21 (input validation) | Implemented | Centralized Zod validation middleware |
| BR-22 (no secrets in logs) | Implemented | Manual audit + error sanitization |
| BR-23 (CI scanning) | Implemented | `npm audit` + `gitleaks` CI job |
| BR-24 (provider fallback, T2 core) | Implemented | `providerConfig.js`, verified with network disconnected |
| BR-25 (≥30 document corpus) | In progress | 10 of ≥30 documents validated as of this writing |

---

## 10. Data handling note

No real personal data is used anywhere in this system. All ingested
documents are synthetic training manuals generated for this project.
