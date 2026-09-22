# Learning Outcomes & Assessment Map

## Session

**Multi-Agent Orchestration in an Industrial Maintenance System**

### Session Duration

90 minutes

### Target Audience

Postgraduate learners with experience in software development and basic familiarity with APIs, databases, and AI/LLM concepts.

---

# 1. Learning Outcomes

By the end of the session, learners will be able to:

## LO1 — Explain Agent-Based Architecture

Explain the role of an AI agent and distinguish between a single-agent workflow and a multi-agent workflow.

### Learner should be able to:

* Define an agent.
* Explain specialization.
* Identify when multiple agents may be useful.
* Explain the trade-offs of multi-agent systems.

---

## LO2 — Design Agent Responsibilities

Design clear responsibilities for specialized agents within an application.

### Learner should be able to:

* Define an agent's responsibility.
* Identify appropriate inputs and outputs.
* Avoid overlapping responsibilities.
* Decide when a component should remain deterministic instead of becoming an AI agent.

---

## LO3 — Explain Orchestration

Explain how an orchestrator coordinates multiple components.

### Learner should be able to:

* Describe workflow sequencing.
* Explain state passing.
* Identify the difference between coordination and business logic.
* Recognize a God Object / overly complex orchestrator.

---

## LO4 — Use Structured Contracts

Explain why structured outputs and schema validation are important when integrating LLMs.

### Learner should be able to:

* Define structured agent outputs.
* Explain schema validation.
* Identify risks of passing arbitrary LLM text between components.
* Explain the boundary between probabilistic AI behavior and deterministic application behavior.

---

## LO5 — Implement Safety Gates

Design deterministic rules that prevent unsafe workflow progression.

### Learner should be able to:

* Identify safety-critical decision points.
* Explain why safety rules should not depend solely on LLM output.
* Implement a safety prerequisite check.
* Stop execution when required safety evidence is missing.

---

## LO6 — Handle Agent Failures

Classify failures and select appropriate recovery behavior.

### Learner should be able to distinguish:

* Transient failures
* Validation failures
* Business-rule failures
* Safety failures
* Low-confidence results

They should also understand when retrying is appropriate and when it is not.

---

## LO7 — Extend an Existing Agentic Workflow

Add a new specialized component without violating the architecture.

### Learner should be able to:

* Add a new agent.
* Define its contract.
* Integrate it into the orchestrator.
* Preserve dependency direction.
* Add tests for the new behavior.

---

## LO8 — Evaluate Agentic Architecture

Reason about the trade-offs introduced by multi-agent systems.

Learners should consider:

* Latency
* Cost
* Complexity
* Reliability
* Testability
* Maintainability
* Observability
* Safety

---

# 2. Assessment Map

| Learning Outcome | Teaching Activity             | Assessment                 |
| ---------------- | ----------------------------- | -------------------------- |
| LO1              | Slides 3–6                    | Discussion questions       |
| LO2              | Slides 9–13                   | Agent design discussion    |
| LO3              | Slides 14–15                  | Architecture walkthrough   |
| LO4              | Slide 16                      | Structured-output exercise |
| LO5              | Slide 12 + Lab Challenge 2    | Safety implementation      |
| LO6              | Slide 17 + Lab Challenge 3    | Failure classification     |
| LO7              | Lab Challenge 1 + Stretch     | Implementation             |
| LO8              | Final discussion + reflection | Design reasoning           |

---

# 3. Assessment During the Session

## Formative Assessment 1 — Prediction

Before showing the safety gate, ask:

> What should happen if the diagnostic agent returns valid diagnostic steps but no safety prerequisites?

Expected reasoning:

```text
Missing safety evidence
        ↓
Do not continue
        ↓
Stop workflow
```

---

## Formative Assessment 2 — Failure Classification

Present:

```text
Temporary provider outage
Missing safety prerequisites
Invalid schema
Low-confidence match
```

Ask:

> Which ones should be retried?

The goal is to assess whether learners understand that retryability depends on failure semantics.

---

## Formative Assessment 3 — Architecture

Ask:

> Where should a new Maintenance History Agent live?

Expected reasoning:

```text
Application
    ↓
Agent
    ↓
Ports
    ↓
Infrastructure
```

---

# 4. Practical Assessment

Learners complete:

### Required

* Maintenance History Agent
* Structured contract
* Workflow integration
* Safety gate
* Failure handling
* Tests

### Optional

* Additional specialized agent
* Additional tests
* Trace improvements
* Architecture documentation

---

# 5. Success Criteria

A learner has achieved the intended outcomes when they can explain:

> Why does this agent exist?

> What does it consume?

> What does it produce?

> What happens if it fails?

> Should the failure be retried?

> What deterministic rules apply after the agent?

> How does the orchestrator coordinate it?

If the learner can answer these questions clearly, they understand the architecture rather than simply reproducing code.
