# System Design Document (SDD)

## Industrial Field Maintenance Copilot (D5 + T2)

This is the most important design document for the submission.

It deliberately separates the architecture into two views:

* **Part A — Target Architecture:** the architecture that would be appropriate for a production deployment at an industrial organization, without the constraints of the MVP time budget.
* **Part B — Implemented MVP:** what was actually built within the approximately 40-hour MVP window, why specific production capabilities were deferred, what mitigations are currently in place, and what would be required to close each gap.

The goal of Part B is not to present the MVP as production-ready. It is to make the trade-offs, risks, and technical reasoning explicit.

---

# Part A — Target Architecture

If this system were being developed for production use by a real industrial organization, the following architecture would be the target.

## A.1 API Gateway and Managed Rate Limiting

A managed API gateway or production ingress such as AWS API Gateway, Kong, or an Nginx/Envoy-based ingress would sit in front of the Express application.

Responsibilities would include:

* TLS termination
* Authentication-related edge policies
* Distributed rate limiting
* Per-tenant and/or per-API-key quotas
* Request and response logging
* Basic WAF protections
* Request-size limits
* Centralized routing

The rate limiter would be distributed rather than process-local. This is important because a process-local limiter becomes ineffective when multiple API instances are running behind a load balancer.

The current MVP uses `express-rate-limit` in-process. This is appropriate for the current single-instance deployment but is explicitly not considered horizontally scalable.

---

## A.2 Secrets Management

Production secrets would be stored in a managed secrets system such as:

* AWS Secrets Manager
* GCP Secret Manager
* HashiCorp Vault

Secrets would include:

* JWT signing secret
* Gemini API key
* Database credentials
* Other provider credentials introduced in future deployments

Secrets would not be committed to source control or stored in deployment configuration files.

The application would obtain them through an authenticated runtime mechanism rather than reading a committed configuration file.

The current MVP uses environment variables supplied through a local `.env` file. The file is gitignored and is not part of the repository.

---

## A.3 Message Broker and Asynchronous Work

A production deployment would decouple long-running operations from the HTTP request lifecycle.

Potential technologies include:

* Redis + BullMQ
* RabbitMQ
* AWS SQS

Document ingestion and long-running workflow execution would become asynchronous jobs.

The API would return a job identifier immediately:

```text
POST /ingest
        |
        v
    202 Accepted
        |
        v
    Job ID
```

Workers would process the job independently.

A production implementation would also provide:

* Job persistence
* Retry policies
* Idempotency
* Cancellation
* Resumability
* Dead-letter handling
* Progress reporting

The current project does not implement this architecture because the assigned project twist is T2 rather than the asynchronous-processing T7 variant.

---

## A.4 Autoscaling

The API and background workers would be independently deployable and scalable.

A production environment could use:

* Kubernetes + Horizontal Pod Autoscaler
* ECS/Fargate
* Cloud Run
* Another managed container platform

Scaling signals could include:

* Request latency
* Requests per second
* CPU/memory utilization
* Queue depth
* Active workflow count

The API tier and worker tier should scale independently because their resource profiles are different.

---

## A.5 Caching

Two caching layers would be useful.

### Embedding Cache

Embeddings could be cached using a deterministic hash of the input text.

```text
input text
    |
    v
SHA-256 hash
    |
    v
Redis cache
    |
    +---- hit ----> existing embedding
    |
    +---- miss ---> embedding provider
```

This avoids repeated embedding computation for identical inputs.

### Retrieval Cache

Short-lived retrieval results could also be cached for repeated queries within a session.

The cache would require an appropriate invalidation strategy because changes to the document corpus can make previous retrieval results stale.

---

## A.6 Managed Vector Storage

The MVP uses PostgreSQL with pgvector.

For a larger deployment, the vector layer could evolve toward:

* A dedicated, tuned PostgreSQL/pgvector deployment
* Pinecone
* Weaviate Cloud
* Another managed vector database

The correct choice would depend on:

* Corpus size
* Query volume
* Required latency
* Availability requirements
* Operational expertise
* Cost

At larger scale, vector indexes would require deliberate tuning, including HNSW parameters and potentially partitioning or sharding strategies.

A managed vector database should not be introduced merely because it is architecturally fashionable. PostgreSQL + pgvector remains a reasonable production choice for many moderate workloads.

---

## A.7 Observability

The production system would use centralized observability.

### Distributed Tracing

OpenTelemetry would capture traces across:

```text
HTTP request
    |
    +--> Retrieval
    |
    +--> Symptom Matcher
    |
    +--> Diagnostic & Safety Planner
    |
    +--> Approval
    |
    +--> Work Order Generator
    |
    +--> LLM provider
```

Trace data could be exported to:

* Jaeger
* Honeycomb
* Datadog
* Another OpenTelemetry-compatible backend

### Structured Logging

Application logs would be structured rather than relying primarily on `console.log` and `console.warn`.

### Metrics

Important metrics would include:

* Request latency
* P50/P95/P99 latency
* Error rate
* Retrieval latency
* Agent latency
* LLM latency
* Token consumption
* Estimated cost
* Refusal rate
* Approval-gate duration
* Workflow completion rate

Cost and refusal metrics are particularly important because this system is both an operational tool and an LLM-powered system.

---

## A.8 CI/CD Environments

A production deployment would separate:

```text
Development
    |
    v
Staging
    |
    v
Production
```

A CI/CD pipeline would:

1. Run tests
2. Run static/security checks
3. Build the container image
4. Push the image to a registry
5. Run database migrations
6. Deploy to staging
7. Run smoke tests
8. Deploy to production

A mature deployment would use blue/green or canary deployment for the API tier.

The MVP currently uses GitHub Actions for CI validation rather than a complete production deployment pipeline.

---

## A.9 Disaster Recovery and Backup

Production PostgreSQL would use automated backups and point-in-time recovery.

The system would define explicit:

* RPO — Recovery Point Objective
* RTO — Recovery Time Objective

Recovery procedures would cover both relational data and vector data.

This matters because an embedding row is logically coupled to its source document/chunk. Restoring one without the other could produce an inconsistent retrieval system.

A recovery runbook would therefore explicitly address:

1. Database restoration
2. Document restoration
3. Vector-index restoration/rebuilding
4. Consistency verification
5. Application recovery

---

## A.10 Cost Model at Scale

For a hypothetical deployment of approximately:

* 1,000 technicians
* 50 workflow runs per technician per day

the largest variable costs would likely come from:

1. LLM completions
2. Embedding generation
3. Compute
4. Database/vector infrastructure
5. Observability and managed infrastructure

The actual monthly cost depends heavily on:

* Average queries per technician
* Average tokens per query
* Workflow depth
* Model selection
* Embedding frequency
* Cache hit rate
* Retrieval corpus size
* Cloud provider
* Availability requirements

The MVP therefore does not claim a precise production cost figure without production usage data.

The evaluation harness records per-run token/cost information, which provides the foundation for replacing this estimate with a usage-based model after real workload data becomes available.

---

# Part B — Implemented MVP

## B.1 Implemented Architecture

The MVP intentionally uses a small number of infrastructure components:

```text
                    React Frontend
                           |
                           v
                    Express API
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        PostgreSQL      LLM Provider   Auth
         + pgvector       |             |
             |            +-------------+
             |            |
             |       Gemini / Ollama
             |
             +--> documents
             +--> chunks
             +--> sessions
             +--> messages
             +--> runs
             +--> agent_steps
             +--> approvals
             +--> work_orders
```

The application follows a Hexagonal Architecture.

The dependency direction is intentionally constrained:

```text
domain
   ^
   |
application
   ^
   |
ports
   ^
   |
infrastructure
```

Domain code has no infrastructure or external SDK dependency.

Application code depends on domain abstractions and ports rather than concrete infrastructure implementations.

Infrastructure contains implementations for external systems such as PostgreSQL and LLM providers.

---

## B.2 Implemented Technology Choices

The MVP uses:

* Node.js
* Express
* PostgreSQL
* pgvector
* React
* JWT authentication
* bcrypt password hashing
* Zod runtime validation
* Gemini as the primary LLM provider
* Ollama as the local/fallback provider
* SSE for streamed responses/progress
* GitHub Actions for CI
* Docker Compose for local infrastructure

The LLM provider abstraction allows the application to switch between the cloud provider and the local Ollama deployment without changing the core application/domain design.

This is particularly useful for the T2 requirement because the system can continue operating with a local model when the external provider is unavailable or unsuitable.

---

# B.3 Retrieval Architecture

The retrieval layer combines semantic and lexical retrieval.

The vector search uses pgvector similarity.

The lexical path uses PostgreSQL full-text search.

The results are combined using Reciprocal Rank Fusion (RRF).

Conceptually:

```text
Query
  |
  +--------------------+
  |                    |
  v                    v
Vector Search      Full-Text Search
  |                    |
  +---------+----------+
            |
            v
           RRF
            |
            v
      Ranked Chunks
```

This was chosen because vector-only retrieval can miss exact terminology while lexical-only retrieval can miss semantically related language.

The resulting ranked context is passed to the relevant agent.

---

# B.4 Agentic Workflow

The implemented workflow contains specialized agents rather than a single unrestricted LLM call.

The main stages are:

```text
User Issue
    |
    v
Symptom Matcher
    |
    v
Diagnostic & Safety Planner
    |
    v
Safety / Approval Gate
    |
    v
Work Order Generator
```

The orchestrator controls the sequence and applies iteration and timeout limits.

The workflow currently uses bounded execution rather than allowing an unrestricted agent loop.

The approval gate prevents the workflow from silently moving directly from diagnosis into an operational work-order action when explicit approval is required.

---

# B.5 Streaming

The API provides SSE-based streaming for operations where incremental progress is useful.

The frontend can display progress while the backend is processing the request rather than waiting for the entire response before updating the UI.

Streaming is currently implemented at the application/API level rather than through a distributed event infrastructure.

---

# B.6 T2 Provider Fallback

The project implements a provider fallback strategy:

```text
              Request
                 |
                 v
           Gemini Provider
                 |
          +------+------+
          |             |
       success        failure
          |             |
          v             v
       Response       Ollama
                        |
                        v
                     Response
```

The local Ollama deployment provides an alternative execution path when the Gemini provider is unavailable or unsuitable.

This is an MVP implementation of the T2 requirement.

The design intentionally hides provider-specific details behind an application-facing abstraction so that provider switching does not leak into the domain layer.

---

# B.7 Database and Persistence

PostgreSQL is used as the primary persistent store.

The database contains operational and audit-oriented data including:

* Users
* Sessions
* Messages
* Runs
* Agent steps
* Approvals
* Work orders
* Documents
* Chunks

The same database stores both operational session history and workflow trace information.

A separate analytics database was considered but rejected for the MVP because the current data volume does not justify the operational complexity of maintaining another datastore.

---

# B.8 Gap Table

| Target component                                | Implemented? | Why deferred                                                                                                                                                                      | Interim mitigation                                                                                                                                                                                                                                | Effort/cost to close                                                                                                      |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Managed API gateway + distributed rate limiting | No           | The MVP runs as a single application instance. Introducing a gateway would add infrastructure without providing meaningful benefit at the current scale.                          | `express-rate-limit` provides process-local protection, including a stricter login limit. This mitigates abuse-driven request/token consumption for the single-instance deployment but does not provide a shared limit across multiple instances. | Approximately 4–6h for Redis-backed shared limiting; a full managed gateway would require additional infrastructure work. |
| Secrets manager                                 | No           | No production deployment infrastructure was required for the local MVP.                                                                                                           | Secrets are supplied through environment variables. `.env` is gitignored and never committed.                                                                                                                                                     | Approximately 2–4h for integration with a managed secrets provider.                                                       |
| Message broker / asynchronous jobs              | No           | T7 was not the assigned project twist; current ingestion and workflow volume is small enough for synchronous processing.                                                          | Synchronous processing is acceptable for the MVP scale. SSE provides progress visibility where streaming is required.                                                                                                                             | Approximately 1–2 days plus resumability, idempotency, retry, and worker-management work.                                 |
| Autoscaling                                     | No           | No cloud deployment target exists in the MVP.                                                                                                                                     | Single-instance deployment is sufficient for demonstration and evaluation.                                                                                                                                                                        | Depends on the selected cloud/container platform.                                                                         |
| Embedding/retrieval cache                       | No           | Current workload does not justify the additional infrastructure. Observed latency was primarily associated with LLM provider behavior rather than repeated embedding computation. | No cache; requests execute directly against the existing retrieval and provider layers.                                                                                                                                                           | Approximately 4h for a basic cache; more for distributed invalidation and monitoring.                                     |
| Managed vector database                         | No           | PostgreSQL + pgvector is sufficient for the current corpus and avoids introducing another managed service.                                                                        | PostgreSQL + pgvector with an HNSW index.                                                                                                                                                                                                         | Depends on corpus scale and selected managed service.                                                                     |
| Full observability stack                        | No           | Centralized tracing, metrics, and log aggregation require additional infrastructure that is outside the local MVP scope.                                                          | Database-backed `correlation_id`, `runs`, and `agent_steps`; per-step and per-run token/cost accounting.                                                                                                                                          | Approximately 1 day for initial OpenTelemetry integration plus a trace backend.                                           |
| Separate CI/CD environments                     | No           | There is no staging/production infrastructure in the MVP.                                                                                                                         | GitHub Actions validates the repository on PRs with tests and security checks.                                                                                                                                                                    | Approximately 1 day after a deployment target exists.                                                                     |
| Automated migration pipeline                    | No           | Migrations are currently executed manually because there is no deployment environment.                                                                                            | Versioned SQL migration files are committed to the repository.                                                                                                                                                                                    | Approximately 4–8h depending on deployment platform.                                                                      |
| Disaster recovery / production backup           | No           | The MVP is a local Docker deployment rather than a production service.                                                                                                            | Docker volume persistence protects against ordinary container recreation but is explicitly not considered a backup strategy.                                                                                                                      | Hosting-dependent; managed PostgreSQL can provide automated backup/PITR capabilities.                                     |
| Production cost model                           | Partial      | There is insufficient real-world workload data to produce a reliable production estimate.                                                                                         | Per-run token/cost fields provide measurement data for future extrapolation.                                                                                                                                                                      | Approximately 1 day once representative workload data exists.                                                             |

---

# B.9 Significant Design Decisions

## Decision 1 — Hexagonal Architecture

The system separates:

* Domain
* Application
* Ports
* Infrastructure

The primary reason was to prevent infrastructure and provider concerns from leaking into the core application logic.

This is especially important for the LLM layer because the system supports multiple providers.

Alternative considered:

A conventional Express structure where controllers directly call repositories and provider SDKs.

Rejected because it would make provider replacement, testing, and architectural boundaries harder to maintain.

---

## Decision 2 — PostgreSQL + pgvector

PostgreSQL with pgvector was selected instead of introducing a separate vector database.

Reasons:

* Relational persistence was already required.
* Documents and chunks naturally belong in the same database.
* Vector search can be performed alongside relational metadata.
* PostgreSQL full-text search can support the lexical retrieval path.
* One datastore reduces operational complexity.
* The current corpus does not justify a separate managed vector platform.

The MVP initially used an IVFFlat configuration and was subsequently moved to HNSW after observing low-recall warnings on a small dataset.

This is an example of an implementation decision being adjusted based on observed retrieval behavior rather than remaining fixed because it was initially configured.

---

## Decision 3 — Hybrid Retrieval + RRF

Vector search alone was not considered sufficient for equipment maintenance terminology.

Exact identifiers, model names, component names, and technical terminology can benefit from lexical matching.

The system therefore combines:

```text
Semantic Retrieval
+
Lexical Retrieval
        |
        v
      RRF
```

Alternative considered:

Vector-only retrieval.

Rejected because exact technical terminology can be poorly represented by semantic similarity alone.

---

## Decision 4 — Plain JavaScript Instead of TypeScript

TypeScript was considered.

The project instead uses JavaScript with ES6+ features and Zod runtime validation.

The reason was primarily MVP scope and team familiarity.

Zod validates important agent boundaries at runtime, including structured outputs exchanged between stages.

The trade-off is explicit:

* Benefit: faster MVP implementation and familiar development environment.
* Cost: no compile-time checking for internal function signatures outside validated boundaries.

For a larger production codebase, migrating the application layer to TypeScript would be a reasonable improvement.

---

## Decision 5 — Repository Pattern with Raw `pg`

Prisma and other ORMs were considered.

The MVP uses the PostgreSQL `pg` driver with explicit repository classes.

This provides direct control over:

* pgvector similarity queries
* PostgreSQL full-text search
* Hybrid retrieval
* SQL performance
* Database-specific features

It also avoids coupling the application/domain layer to generated ORM models.

The trade-off is that developers are responsible for SQL construction, migration management, and stronger repository-level testing.

---

## Decision 6 — Same Database for Operational History and Trace Data

The `sessions`, `messages`, `runs`, and `agent_steps` tables serve both operational and audit purposes.

A separate analytics store was considered.

It was rejected because the MVP volume does not justify the additional datastore.

At production scale, a separate analytical/read-optimized system could become appropriate if historical trace queries began competing with operational workloads.

---

## Decision 7 — SSE for Streaming

Server-Sent Events were selected for streamed application responses and progress updates.

Alternative:

WebSockets.

SSE was preferred for the MVP because the primary requirement is server-to-client streaming rather than bidirectional real-time communication.

The browser can maintain a standard HTTP connection and receive incremental events without introducing the additional lifecycle and protocol complexity of WebSockets.

---

## Decision 8 — T2 Provider Fallback

The system uses Gemini as the primary provider and Ollama as the local/fallback provider.

This decision supports the T2 requirement while also improving development resilience when an external provider is unavailable.

The provider boundary is kept outside the domain layer so the core application does not depend directly on Gemini or Ollama SDK details.

---

## Decision 9 — Explicit Safety Refusal

The system intentionally refuses to continue when required safety information cannot be established.

In particular, the diagnostic/safety stage requires a valid safety-prerequisite output.

A best-effort reconstruction of missing safety information was explicitly rejected.

This reflects the system's central safety principle:

> Missing safety information should produce a controlled refusal rather than an invented or reconstructed safety instruction.

---

# B.10 Expedient / Poor Choice Under Time Pressure

An important example occurred in the evaluation harness.

The initial security check searched for a literal prompt-injection phrase anywhere in the generated answer.

This produced a false failure when the model correctly repeated the injected phrase while explaining that it had ignored it.

The measurement logic was therefore weaker than the behavior it was attempting to measure.

The issue was discovered through manual inspection of the actual response rather than being hidden behind the initial evaluation score.

The planned correction is to check for compliance-indicating language rather than treating every occurrence of the source phrase as evidence of compromise.

This remains documented as an evaluation-harness improvement rather than silently rewriting the historical result.

---

# B.11 AI-Assisted Development Incident

During development, an AI coding assistant introduced a `buildGroundedFallbackResponse` method into the `DiagnosticSafetyPlannerAgent`.

The change appeared beneficial because it reduced refusals.

However, it weakened an important safety property: when the LLM failed to produce the required safety-prerequisite structure, the agent would reconstruct an answer directly from retrieved chunks rather than refusing.

That behavior was not requested.

It was detected during code review and reverted before becoming part of the final behavior.

The associated test was also corrected to assert refusal.

The incident is documented separately in `docs/AI-USAGE-LOG.md`.

The lesson is architectural as well as procedural:

> A lower refusal rate is not automatically an improvement when refusal is itself part of the system's safety contract.

---

# B.12 Current Production Risks

The most important unresolved risks are:

1. **Process-local rate limiting**

   * Does not coordinate across horizontally scaled instances.
   * Could allow higher aggregate request volume after scaling.

2. **External LLM dependency**

   * Provider availability and rate limits can affect latency and availability.
   * Ollama provides a local fallback but has different quality/performance characteristics.

3. **Synchronous long-running operations**

   * Large ingestion or workflow workloads could tie up application resources.
   * A production deployment should move these operations to workers.

4. **Limited centralized observability**

   * Database traces provide useful audit information but are not equivalent to distributed tracing and metrics infrastructure.

5. **No production backup strategy**

   * Docker volume persistence is not a disaster-recovery mechanism.

6. **No horizontal scaling**

   * The current deployment assumes a single application instance.

These risks are acceptable for the defined MVP scope but would need to be addressed before production deployment.

---

# B.13 Architecture Evolution Path

The MVP can evolve toward the target architecture incrementally.

A practical migration path is:

```text
Current MVP
    |
    +--> Redis-backed rate limiting
    |
    +--> Managed secrets
    |
    +--> OpenTelemetry
    |
    +--> Background workers / queue
    |
    +--> Managed PostgreSQL
    |
    +--> Autoscaled API + workers
    |
    +--> Production backup / DR
    |
    +--> Full CI/CD environments
```

The important architectural property is that these additions do not require rewriting the domain model or the core agent contracts.

The current separation between application logic, ports, and infrastructure is intended to make this evolution incremental rather than requiring a second implementation of the system.

---

# B.14 Summary

The MVP deliberately favors a small operational footprint:

* One API process
* PostgreSQL + pgvector
* Gemini/Ollama provider abstraction
* Synchronous orchestration
* SSE streaming
* Database-backed workflow tracing
* GitHub Actions CI
* Docker-based local deployment

This is not presented as the final production architecture.

The principal architectural objective of the MVP was to establish the core maintenance workflow, grounded retrieval, safety behavior, approval gate, traceability, provider fallback, and clean dependency boundaries within the available time.

The deferred production capabilities are documented explicitly so that the current limitations are measurable rather than hidden.

The most important remaining production work is not a rewrite of the core system. It is the addition of operational infrastructure around it: distributed rate limiting, secrets management, asynchronous workers, centralized observability, production deployment environments, scaling, and disaster recovery.
