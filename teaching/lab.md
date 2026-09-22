# Hands-On Lab — Multi-Agent Orchestration

## Industrial Field Maintenance Copilot

### Duration

**25–35 minutes**

### Difficulty

Postgraduate / Intermediate Software Engineering

### Repository

Industrial Field Maintenance Copilot

---

# 1. Lab Overview

In this lab, you will extend an existing multi-agent maintenance workflow.

The current workflow is:

```text
User Issue
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

You will practice:

* Designing an agent
* Defining agent responsibilities
* Passing structured state
* Extending an orchestrator
* Applying deterministic safety rules
* Handling agent failures
* Preserving architectural boundaries

---

# 2. Learning Goals

After completing the lab, you should be able to:

* Identify where a new agent belongs.
* Define a clear agent input/output contract.
* Integrate a new agent into an existing workflow.
* Add deterministic business rules around AI output.
* Distinguish retryable and non-retryable failures.
* Extend a workflow without creating unnecessary coupling.

---

# 3. Before You Start

Make sure the application is running.

From the project root:

```bash
docker compose up --build
```

Verify the containers:

```bash
docker compose ps
```

You should have the application, database, and Ollama service running.

Check the local model:

```bash
docker exec -it maintenance_copilot_ollama ollama list
```

Expected model:

```text
llama3.2:3b
```

---

# 4. Understand the Existing Workflow

Before changing code, locate the workflow implementation.

Look for:

```text
MaintenanceWorkflowOrchestrator
```

and the existing agents:

```text
Symptom Matcher
Diagnostic & Safety Planner
Work Order Generator
```

Also identify:

* Agent interfaces/contracts
* Zod schemas
* Workflow state
* Error classes
* Retry/timeout logic
* Persistence/trace logic

### Instructor Question

Ask learners:

> "If we add a new agent, which layer should contain it?"

Expected discussion:

```text
application/
    agents/
    orchestrator/
```

The agent should not directly depend on infrastructure implementations.

---

# 5. Challenge 1 — Add a Maintenance History Agent

## Goal

Add a new specialized agent that provides historical maintenance context for the equipment.

The new workflow becomes:

```text
User Issue
    ↓
Symptom Matcher
    ↓
Maintenance History Agent
    ↓
Diagnostic & Safety Planner
    ↓
Safety / Approval Gate
    ↓
Work Order Generator
```

---

## 5.1 Define the Responsibility

The Maintenance History Agent should answer:

> "What relevant maintenance history do we have for this equipment?"

It should **not**:

* Generate the final work order.
* Make safety decisions.
* Replace the diagnostic planner.
* Approve the workflow.

---

## 5.2 Define the Input

The agent should receive enough information to identify the equipment.

Example:

```javascript
{
  equipment: "RK-450 Rotary Kiln Drive System",
  symptom: "Drive assembly vibration"
}
```

---

## 5.3 Define the Output

Define a structured output.

Example:

```javascript
{
  history: [
    {
      date: "2026-07-12",
      issue: "Drive vibration",
      action: "Coupling inspection",
      result: "Alignment adjusted"
    }
  ]
}
```

If there is no relevant history:

```javascript
{
  history: []
}
```

---

## 5.4 Implementation Task

Create a new application-level agent.

Suggested location:

```text
application/
└── agents/
    └── maintenance-history-agent.js
```

The exact location may differ depending on the repository structure.

Implement:

```text
MaintenanceHistoryAgent
```

with a clear public operation such as:

```javascript
execute(input)
```

---

## 5.5 Integration Task

Update the orchestrator.

The history agent should execute **after symptom matching**.

Conceptually:

```javascript
const symptom = await symptomMatcher.execute(input);

const history = await maintenanceHistoryAgent.execute({
  equipment: symptom.equipment,
  symptom: symptom.symptom
});

const diagnosticPlan =
  await diagnosticSafetyPlanner.execute({
    symptom,
    history
  });
```

Do not put the history agent's internal logic inside the orchestrator.

---

## 5.6 Validation

Verify that:

1. The new agent executes.
2. Its output is structured.
3. The diagnostic planner receives the history.
4. Existing workflow behavior still works.
5. The workflow trace contains the new step.

---

# 6. Challenge 2 — Add a Safety Rule

## Goal

Implement a deterministic rule:

> A work order must never be generated when required safety prerequisites are missing.

This rule must be enforced by application logic.

Do not rely only on the LLM prompt.

---

## 6.1 Example Invalid Output

Suppose the Diagnostic & Safety Planner returns:

```javascript
{
  diagnosticSteps: [
    "Inspect the drive assembly",
    "Check coupling alignment"
  ],
  safetyPrerequisites: []
}
```

This should **not** continue to work-order generation.

---

## 6.2 Expected Behavior

```text
Safety prerequisites missing
          ↓
      STOP WORKFLOW
          ↓
No Work Order
```

---

## 6.3 Implementation Task

Find the point between:

```text
Diagnostic & Safety Planner
```

and:

```text
Work Order Generator
```

Add a deterministic validation step.

Pseudo-code:

```javascript
if (!diagnosticPlan.safetyPrerequisites?.length) {
  throw new SafetyPrerequisiteSkippedError();
}
```

The exact implementation should follow the repository's existing error-handling conventions.

---

## 6.4 Important Question

Ask:

> Why shouldn't we ask the LLM to generate missing safety information?

Expected reasoning:

Because the missing information may be critical safety information.

The system should not silently transform:

```text
Missing evidence
```

into:

```text
AI-generated safety instruction
```

The correct behavior may be to stop and require additional grounded information.

---

## 6.5 Validation

Test at least two cases.

### Case A — Valid

```javascript
{
  safetyPrerequisites: [
    "Follow lockout/tagout procedure",
    "Verify zero-energy state"
  ]
}
```

Expected:

```text
Workflow continues
```

### Case B — Invalid

```javascript
{
  safetyPrerequisites: []
}
```

Expected:

```text
Workflow stops
```

and:

```text
Work order is not generated
```

---

# 7. Challenge 3 — Handle Agent Failure

## Goal

Modify or simulate an agent failure.

The system should distinguish between different failure types.

---

## 7.1 Failure Type A — Transient

Example:

```text
LLM provider temporarily unavailable
```

Expected behavior:

```text
Failure
   ↓
Classify as transient
   ↓
Retry with backoff
   ↓
Continue if successful
```

---

## 7.2 Failure Type B — Invalid Output

Example:

```text
LLM returned invalid structured data
```

Expected behavior:

```text
Invalid output
      ↓
Validation failure
      ↓
Do not blindly retry forever
```

---

## 7.3 Failure Type C — Safety Failure

Example:

```text
Safety prerequisites missing
```

Expected behavior:

```text
Safety failure
      ↓
STOP
```

No retry should be used to bypass the safety requirement.

---

# 8. Failure Classification Exercise

Create the following table.

| Failure                          | Retry? | Reason |
| -------------------------------- | ------ | ------ |
| Temporary provider outage        | ?      | ?      |
| Missing safety prerequisites     | ?      | ?      |
| Invalid Zod output               | ?      | ?      |
| Database temporarily unavailable | ?      | ?      |
| Low-confidence symptom match     | ?      | ?      |

Discuss your answers before looking at the answer key.

---

# 9. Stretch Challenge — Add a New Agent Without Breaking Architecture

## Goal

Add another specialized agent.

Choose one:

### Option A — Spare Parts Agent

Identifies potentially required spare parts.

```text
Input:
Equipment + Diagnosis

Output:
Required parts
```

### Option B — Technician Skill Agent

Identifies the required technician skill level.

```text
Input:
Equipment + Task

Output:
Required skill
```

### Option C — Estimated Duration Agent

Estimates the maintenance duration.

```text
Input:
Equipment + Diagnostic Plan

Output:
Estimated duration
```

---

# 10. Architectural Constraint

Your new agent must not directly depend on infrastructure implementations.

Avoid:

```javascript
import postgres from "...";
import GeminiSDK from "...";
```

inside the domain/application logic when the architecture expects access through ports.

Prefer:

```text
Application
    ↓
Port / Interface
    ↓
Infrastructure Adapter
    ↓
External Service
```

---

# 11. Stretch Challenge — Orchestrator Design

After adding your agent, inspect the orchestrator.

Ask:

> "Did I make the orchestrator responsible for too much?"

Bad design:

```text
Orchestrator
├── Retrieval logic
├── LLM prompts
├── Database queries
├── Safety rules
├── Validation
├── Work-order formatting
└── Agent coordination
```

Better:

```text
Orchestrator
    │
    ├── Agent A
    ├── Agent B
    ├── Safety Gate
    └── Agent C
```

The orchestrator coordinates.

Specialized components perform specialized work.

---

# 12. Expected Workflow After the Lab

A successful implementation should conceptually look like:

```text
                    User Issue
                        │
                        ▼
               ┌─────────────────┐
               │ Symptom Matcher │
               └────────┬────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │ Maintenance History │
             └──────────┬──────────┘
                        │
                        ▼
          ┌───────────────────────────┐
          │ Diagnostic & Safety       │
          │ Planner                   │
          └────────────┬──────────────┘
                       │
                       ▼
                ┌─────────────┐
                │ Safety Gate │
                └──────┬──────┘
                       │
                  ┌────┴────┐
                  │         │
                Valid     Invalid
                  │         │
                  ▼         ▼
             Approval      STOP
                  │
                  ▼
        ┌─────────────────────┐
        │ Work Order Generator│
        └──────────┬──────────┘
                   │
                   ▼
              Work Order
```

---

# 13. Deliverables

At the end of the lab, learners should have:

### Required

* [ ] Maintenance History Agent
* [ ] Structured input/output
* [ ] Agent integrated into workflow
* [ ] Safety prerequisite validation
* [ ] Failure classification
* [ ] Tests for the new behavior

### Stretch

* [ ] Additional specialized agent
* [ ] Updated orchestrator
* [ ] Updated schemas/contracts
* [ ] Updated trace output
* [ ] Documentation of the design decision

---

# 14. Self-Check

Before finishing, answer these questions:

### Question 1

Why did we create a separate Maintenance History Agent instead of adding its logic to the Diagnostic Agent?

---

### Question 2

Where should deterministic safety rules live?

---

### Question 3

Should every LLM failure be retried?

---

### Question 4

What should happen when safety prerequisites are missing?

---

### Question 5

What is the orchestrator responsible for?

---

### Question 6

How do structured contracts help when integrating LLMs?

---

# 15. Success Criteria

You have successfully completed the lab if:

```text
✓ New agent has one clear responsibility
✓ Agent input/output is structured
✓ Agent is integrated through the workflow
✓ Safety rule is deterministic
✓ Missing safety information stops execution
✓ Retry behavior is bounded
✓ Failures are classified
✓ Existing tests still pass
✓ Architecture boundaries remain intact
```

---

# 16. Instructor Discussion

After the implementation, discuss:

### Trade-off 1

Would you really add a Maintenance History Agent in production?

Why?

Possible considerations:

* Does it provide enough value?
* Does it introduce unnecessary latency?
* Is the data source reliable?
* Could retrieval already provide this context?

---

### Trade-off 2

When does multi-agent architecture become over-engineering?

Consider:

```text
More Agents
    ↓
More boundaries
    ↓
More latency
    ↓
More failure points
    ↓
More operational complexity
```

The goal is not to maximize the number of agents.

The goal is to create an architecture that makes the system easier to reason about.

---

# 17. Final Reflection

Write a short answer:

> "If I were designing this system from scratch, which responsibilities would I keep as separate agents, and which would I keep deterministic?"

Use these criteria:

* Safety
* Complexity
* Latency
* Reliability
* Testability
* Cost
* Maintainability
