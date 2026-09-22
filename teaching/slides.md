# Multi-Agent Orchestration in an Industrial Maintenance System

## Slide 1 — Title

### Multi-Agent Orchestration in an Industrial Maintenance System

**From a User Issue to a Safe, Traceable Work Order**

Industrial Field Maintenance Copilot

---

## Slide 2 — Learning Objectives

By the end of this session, learners will be able to:

* Explain what an AI agent is.
* Explain why multiple specialized agents can be useful.
* Design responsibilities for multiple agents.
* Understand how an orchestrator coordinates agents.
* Pass structured data between agents.
* Validate LLM outputs.
* Apply timeouts, retries, and failure classification.
* Design safety and approval gates.
* Extend a multi-agent workflow without breaking the architecture.

---

## Slide 3 — Why Not One LLM Call?

Imagine a technician reports:

> "The rotary kiln drive is vibrating and the motor temperature is increasing."

A single LLM could generate an answer.

But the system needs to answer several different questions:

1. What equipment or symptom does this describe?
2. What diagnostic steps are relevant?
3. What safety prerequisites are required?
4. Should the workflow continue?
5. What work order should be created?

### The problem

One large prompt can become:

* Hard to validate
* Hard to test
* Hard to debug
* Hard to secure
* Difficult to extend

---

## Slide 4 — What Is an Agent?

An **agent** is a software component responsible for a specific decision or task.

An agent may:

* Analyze information
* Retrieve knowledge
* Call an LLM
* Validate information
* Transform data
* Apply business rules
* Produce structured output

### Important

An agent does **not** necessarily mean:

> "A component that always calls an LLM."

Some agents can perform deterministic operations.

---

## Slide 5 — What Is Multi-Agent Orchestration?

Multi-agent orchestration means coordinating multiple specialized components to complete one larger task.

Instead of:

```text
User
  ↓
One huge LLM prompt
  ↓
Final answer
```

We can use:

```text
User
  ↓
Symptom Matcher
  ↓
Diagnostic & Safety Planner
  ↓
Safety / Approval Gate
  ↓
Work Order Generator
  ↓
Final Work Order
```

Each component has a narrower responsibility.

---

## Slide 6 — Single Agent vs Multi-Agent

### Single-Agent Approach

```text
User
  ↓
LLM
  ↓
Answer
```

### Multi-Agent Approach

```text
User
  ↓
Agent A
  ↓
Agent B
  ↓
Business/Safety Gate
  ↓
Agent C
  ↓
Result
```

### Trade-off

Multi-agent systems can improve:

* Separation of responsibilities
* Debuggability
* Validation
* Extensibility

But they also introduce:

* More latency
* More failure points
* More implementation complexity
* More token/API cost

**More agents does not automatically mean a better system.**

---

## Slide 7 — Our Industrial Maintenance Problem

A technician reports an equipment problem.

The system must transform the report into an actionable maintenance workflow.

### Input

```text
Equipment:
RK-450 Rotary Kiln Drive System

Issue:
Abnormal vibration near the drive assembly.
```

### Desired result

```text
Symptom Match
      ↓
Diagnostic Steps
      ↓
Safety Prerequisites
      ↓
Approval
      ↓
Work Order
```

The system must remain grounded in the maintenance knowledge base.

---

## Slide 8 — System Architecture

```text
                    ┌──────────────────┐
                    │      React       │
                    │    Frontend      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Express API    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐   ┌───────────┐   ┌──────────┐
        │ Retrieval│   │Orchestrator│   │   Auth   │
        └────┬─────┘   └─────┬─────┘   └──────────┘
             │               │
             ▼               ▼
        PostgreSQL       Agent Workflow
        + pgvector
```

The orchestrator coordinates the application workflow.

External services are accessed through infrastructure adapters.

---

## Slide 9 — Agent Responsibilities

Our workflow contains specialized responsibilities.

| Component                   | Responsibility                                    |
| --------------------------- | ------------------------------------------------- |
| Symptom Matcher             | Identify the most relevant equipment/symptom      |
| Diagnostic & Safety Planner | Produce diagnostic steps and safety prerequisites |
| Safety / Approval Gate      | Decide whether workflow can continue              |
| Work Order Generator        | Create the final actionable work order            |
| Orchestrator                | Coordinate the complete workflow                  |

### Design principle

Each component should have a **clear responsibility**.

---

## Slide 10 — Symptom Matcher Agent

### Input

```text
User issue
+
Retrieved maintenance knowledge
```

### Responsibility

Identify the most relevant equipment and symptom.

### Example

```text
Input:
"Abnormal vibration near the kiln drive."

Output:
Equipment:
RK-450 Rotary Kiln Drive System

Symptom:
Drive assembly vibration
```

### Why separate it?

The next agent should not have to solve:

* Equipment identification
* Diagnosis
* Safety planning
* Work-order generation

all at once.

---

## Slide 11 — Diagnostic & Safety Planner

This agent receives the matched symptom and grounded context.

### It produces two critical outputs

```text
DIAGNOSTIC STEPS:

1. Inspect the drive assembly.
2. Check coupling condition.
3. Measure vibration levels.
4. Compare measurements with documented limits.


SAFETY PREREQUISITES:

1. Follow site lockout/tagout procedure.
2. Isolate the equipment before inspection.
3. Verify zero-energy state.
```

### Important rule

The system must not silently invent safety instructions.

If required safety information is missing:

```text
Refuse to proceed
```

---

## Slide 12 — Safety / Approval Gate

Before generating a work order, the workflow evaluates whether it is safe to continue.

```text
Diagnostic + Safety Output
          │
          ▼
   ┌───────────────┐
   │ Safety Check  │
   └───────┬───────┘
           │
      ┌────┴────┐
      │         │
    Valid     Invalid
      │         │
      ▼         ▼
 Approval     Refuse
   Gate       Workflow
```

### Why?

An AI system should not treat:

> "The model generated an answer"

as equivalent to:

> "The answer is safe to execute."

---

## Slide 13 — Work Order Generator

After the required checks succeed, the system can generate a structured work order.

### Example

```text
WORK ORDER

Equipment:
RK-450 Rotary Kiln Drive System

Problem:
Abnormal drive vibration

Priority:
High

Diagnostic Steps:
...

Safety Prerequisites:
...

Required Actions:
...

Status:
Pending Approval
```

The generator receives structured information rather than starting from an empty prompt.

---

## Slide 14 — The Orchestrator

The orchestrator coordinates the workflow.

Conceptually:

```text
1. Match symptom
       ↓
2. Validate result
       ↓
3. Plan diagnosis + safety
       ↓
4. Validate safety
       ↓
5. Request approval
       ↓
6. Generate work order
       ↓
7. Persist trace
```

### The orchestrator should coordinate.

It should **not** become a giant class containing every business rule.

---

## Slide 15 — State Between Agents

Agents need structured information from previous steps.

Example:

```javascript
{
  equipment: "RK-450",
  symptom: "Drive vibration",
  diagnosticSteps: [...],
  safetyPrerequisites: [...],
  retrievedSources: [...]
}
```

The next agent consumes the relevant state.

### Why structured state?

It provides:

* Clear contracts
* Easier validation
* Better debugging
* Better testing
* Less accidental coupling

---

## Slide 16 — Structured Outputs + Validation

LLMs produce text.

Our application needs reliable data.

Instead of trusting:

```text
"Here are some steps..."
```

we define a contract.

Example:

```text
DiagnosticPlan
├── diagnosticSteps[]
└── safetyPrerequisites[]
```

Then validate the result before continuing.

### Key idea

```text
LLM Output
    ↓
Schema Validation
    ↓
Valid? ─── No ──→ Failure
    │
   Yes
    ↓
Next Step
```

Validation creates a boundary between probabilistic AI output and deterministic application logic.

---

## Slide 17 — Failure, Timeout & Retry

AI systems fail in different ways.

### Transient failure

Example:

```text
LLM API temporarily unavailable
```

Possible action:

```text
Retry with backoff
```

### Deterministic failure

Example:

```text
Invalid structured output
```

Retrying may not solve the problem.

### Safety failure

Example:

```text
Required safety prerequisites are missing
```

Correct action:

```text
STOP
```

### Important

**Retries are not a universal solution.**

The system should classify failures before deciding what to do.

---

## Slide 18 — Live Demo / Repository Walkthrough

### Demo flow

1. Start the application with Docker.
2. Login as a technician.
3. Ingest maintenance documents.
4. Ask a grounded maintenance question.
5. Show citations.
6. Test a case where required safety information is missing.
7. Show the refusal.
8. Start a multi-agent workflow.
9. Show live progress through SSE.
10. Show the approval gate.
11. Inspect the execution trace.

### Watch for

* Agent boundaries
* Structured outputs
* Safety gate
* Persistence
* Failure handling
* Traceability

---

## Slide 19 — Hands-on Challenge

### Challenge

Extend the maintenance workflow.

#### Challenge 1 — Maintenance History Agent

Add an agent that retrieves relevant historical maintenance information.

Input:

```text
Equipment
+
Current symptom
```

Output:

```text
Previous maintenance events
+
Relevant observations
```

---

### Challenge 2 — Add a Safety Rule

Implement a rule:

> A work order cannot be generated when required safety prerequisites are missing.

Expected behavior:

```text
Missing safety information
        ↓
Workflow stops
        ↓
No work order generated
```

---

### Challenge 3 — Handle Agent Failure

Simulate an agent failure.

The system should:

* Detect the failure.
* Classify it.
* Retry only if appropriate.
* Stop when retrying cannot help.
* Persist enough information for debugging.

---

### Stretch Challenge 4 — Add a New Agent

Add another specialized agent without modifying unrelated agents.

Ask yourself:

> Where should this agent live?

> What interface does it need?

> What data does it consume?

> What data does it produce?

> Does the orchestrator become more complicated?

---

## Slide 20 — Key Takeaways

### 1. Specialization

Give each component a clear responsibility.

### 2. Orchestration

The orchestrator coordinates the workflow.

### 3. Structured Contracts

Do not blindly pass arbitrary LLM text between components.

### 4. Safety Gates

AI output should not bypass deterministic safety rules.

### 5. Failure Classification

Not every failure should be retried.

### 6. Observability

Persist enough information to understand what happened.

### Final Principle

> **A multi-agent system is not about adding more LLM calls.**

It is about designing a reliable workflow where specialized components cooperate under explicit rules.

---

# Suggested 90-Minute Delivery Plan

| Time      | Activity                      |
| --------- | ----------------------------- |
| 0–10 min  | Problem + motivation          |
| 10–25 min | Agents + multi-agent concepts |
| 25–40 min | System architecture           |
| 40–55 min | Agent responsibilities        |
| 55–65 min | Safety + failure handling     |
| 65–75 min | Live repository demo          |
| 75–88 min | Hands-on lab                  |
| 88–90 min | Recap + questions             |

# Instructor Notes

## Teaching Style

Do not read the slides word-for-word.

For each concept:

1. Explain the idea.
2. Show the project implementation.
3. Ask learners to predict the behavior.
4. Reveal the implementation.
5. Discuss the trade-off.

### Example Question

Before showing the safety gate:

> "What should the system do if the model provides diagnostic steps but no safety prerequisites?"

Let learners answer first.

Then show:

```text
Safety prerequisites missing
          ↓
Workflow must stop
```

This turns the architecture into a reasoning exercise rather than a lecture.
