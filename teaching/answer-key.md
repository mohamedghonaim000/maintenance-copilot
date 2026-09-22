# Teaching Lab — Answer Key

## Multi-Agent Orchestration in an Industrial Maintenance System

> **Instructor-only material**
>
> This document provides the expected reasoning, implementation approach, validation criteria, and common mistakes for the hands-on lab.

---

# 1. Lab Solution Overview

The target workflow after completing the required challenges is:

```text
User Issue
    ↓
Symptom Matcher
    ↓
Maintenance History Agent
    ↓
Diagnostic & Safety Planner
    ↓
Safety Gate
    ↓
Approval
    ↓
Work Order Generator
    ↓
Final Work Order
```

The important architectural principle is:

> Each component should have one clear responsibility, while the orchestrator coordinates the sequence.

---

# 2. Challenge 1 — Maintenance History Agent

## Expected Design

The learner should create a specialized application-level agent.

Conceptually:

```text
application/
├── agents/
│   ├── symptom-matcher-agent.js
│   ├── diagnostic-safety-planner.js
│   ├── maintenance-history-agent.js
│   └── work-order-generator.js
```

The exact filenames may differ in the repository.

---

## Expected Responsibility

The Maintenance History Agent should:

* Receive equipment information.
* Receive the relevant symptom when useful.
* Retrieve or analyze historical maintenance information.
* Return structured historical context.

It should **not**:

* Generate the final work order.
* Make safety decisions.
* Approve the workflow.
* Own orchestration logic.

---

## Expected Input Contract

A reasonable contract is:

```javascript
{
  equipment: "RK-450 Rotary Kiln Drive System",
  symptom: "Drive assembly vibration"
}
```

The learner may use a richer structure if the existing application contracts require it.

---

## Expected Output Contract

For example:

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

No historical records:

```javascript
{
  history: []
}
```

---

## Important Teaching Point

Do not focus only on whether the agent "works."

Ask:

> "Can another developer understand the agent's responsibility without reading the entire workflow?"

If the answer is no, the abstraction is probably too broad.

---

# 3. Integrating the New Agent

The expected orchestration sequence is:

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

The exact syntax depends on the project's existing interfaces.

---

## What Should NOT Happen

Avoid:

```javascript
const history = await db.query(...);
```

inside the orchestrator if database access belongs behind a port/adapter.

Also avoid putting the entire history implementation inside:

```text
MaintenanceWorkflowOrchestrator
```

The orchestrator should coordinate.

---

# 4. Challenge 1 — Validation

The instructor should verify:

### Required

* Agent exists.
* Agent has a clear responsibility.
* Input is explicit.
* Output is structured.
* Agent is called after symptom matching.
* History is passed to the next relevant step.
* Existing workflow still works.

### Traceability

The workflow trace should show something conceptually like:

```text
1. Symptom Matcher
2. Maintenance History
3. Diagnostic & Safety Planner
4. Safety Gate
5. Approval
6. Work Order Generator
```

The exact trace format may differ.

---

# 5. Challenge 2 — Safety Rule

## Expected Rule

The core requirement is:

```text
No safety prerequisites
        ↓
STOP WORKFLOW
        ↓
No work order
```

The rule must be deterministic.

---

## Expected Implementation

A reasonable implementation is:

```javascript
if (
  !diagnosticPlan.safetyPrerequisites ||
  diagnosticPlan.safetyPrerequisites.length === 0
) {
  throw new SafetyPrerequisiteSkippedError();
}
```

The learner should use the project's existing error class and error-handling conventions.

---

# 6. Why the Rule Must Be Deterministic

This is one of the most important teaching points in the lab.

Do not do this:

```text
LLM returned no safety information
        ↓
Ask another LLM to invent safety information
        ↓
Continue
```

The missing information is precisely the reason the system cannot safely continue.

Instead:

```text
Missing safety evidence
        ↓
Deterministic application rule
        ↓
Stop
```

---

# 7. Valid Safety Case

Example:

```javascript
{
  diagnosticSteps: [
    "Inspect the drive assembly",
    "Check coupling alignment"
  ],
  safetyPrerequisites: [
    "Follow lockout/tagout procedure",
    "Verify zero-energy state"
  ]
}
```

Expected:

```text
Safety validation
      ↓
PASS
      ↓
Approval
      ↓
Work Order Generator
```

---

# 8. Invalid Safety Case

Example:

```javascript
{
  diagnosticSteps: [
    "Inspect the drive assembly"
  ],
  safetyPrerequisites: []
}
```

Expected:

```text
Safety validation
      ↓
FAIL
      ↓
SafetyPrerequisiteSkippedError
      ↓
Workflow stops
```

The work-order generator must not execute.

---

# 9. Critical Test

A good implementation should test not only the error but also the side effect.

Bad test:

```javascript
expect(() => workflow()).toThrow();
```

Better conceptual test:

```text
Given:
  diagnostic plan has no safety prerequisites

When:
  workflow executes

Then:
  workflow fails with safety error

And:
  work-order generation is not called
```

This verifies the actual safety invariant.

---

# 10. Suggested Test Structure

The exact testing framework should follow the repository.

Conceptually:

```javascript
it("stops when safety prerequisites are missing", async () => {
  const diagnosticPlan = {
    diagnosticSteps: ["Inspect drive"],
    safetyPrerequisites: []
  };

  await expect(
    orchestrator.execute(input)
  ).rejects.toThrow(SafetyPrerequisiteSkippedError);

  expect(workOrderGenerator.execute)
    .not.toHaveBeenCalled();
});
```

The exact mocking strategy depends on the existing test architecture.

---

# 11. Challenge 3 — Failure Classification

The learner should classify failures rather than treating all errors equally.

Expected classification:

| Failure                       |                              Retry? | Reason                                                      |
| ----------------------------- | ----------------------------------: | ----------------------------------------------------------- |
| Temporary LLM/provider outage |                                 Yes | May recover without changing input                          |
| Missing safety prerequisites  |                                  No | Safety/business rule failure                                |
| Invalid structured output     | Usually bounded / context-dependent | Retrying indefinitely does not fix deterministic invalidity |
| Temporary DB/network failure  |                                 Yes | Potentially transient                                       |
| Low-confidence symptom match  |                                  No | Repeating the same reasoning may not add evidence           |

---

# 12. Transient Failure

Example:

```text
Provider unavailable
```

Expected flow:

```text
Agent
 ↓
Transient Error
 ↓
Retry Policy
 ↓
Backoff
 ↓
Retry
```

The retry count must remain bounded.

For example:

```text
MAX_ITERATIONS = 5
```

or another explicit limit defined by the implementation.

---

# 13. Non-Transient Failure

Example:

```text
LowConfidenceMatchError
```

Expected:

```text
Agent
 ↓
Low Confidence
 ↓
Stop
```

Do not waste additional model calls if the application already knows that retrying will not change the evidence.

---

# 14. Safety Failure

Example:

```text
SafetyPrerequisiteSkippedError
```

Expected:

```text
Safety Failure
      ↓
STOP
```

This should not be classified as a normal transient provider failure.

---

# 15. Challenge 3 — Expected Error Handling

A robust workflow should conceptually implement:

```javascript
try {
  return await executeStep();
} catch (error) {
  if (isTransientError(error)) {
    return retryWithBackoff(...);
  }

  throw error;
}
```

The exact implementation should use the project's existing resilience utilities.

---

# 16. Stretch Challenge — Additional Agent

There are several valid solutions.

The learner may choose:

```text
Spare Parts Agent
Technician Skill Agent
Estimated Duration Agent
```

The instructor should accept any solution that satisfies the architecture.

---

# 17. Example — Spare Parts Agent

### Input

```javascript
{
  equipment: "RK-450",
  diagnosis: {
    symptom: "Drive vibration"
  }
}
```

### Output

```javascript
{
  parts: [
    {
      name: "Drive coupling",
      quantity: 1,
      reason: "Potential replacement after inspection"
    }
  ]
}
```

The important part is not the exact output.

The important part is that the contract is explicit and the responsibility is narrow.

---

# 18. Stretch Challenge — Architecture Check

Ask the learner to explain:

> "Why does the new agent belong in the application layer?"

Expected answer:

Because the agent represents application behavior/orchestration logic and should depend on abstractions rather than concrete infrastructure implementations.

Conceptually:

```text
Application
     ↓
Ports
     ↓
Infrastructure
     ↓
External Systems
```

---

# 19. Architecture Violation Example

Reject an implementation like:

```javascript
// inside an application agent

import { GoogleGenerativeAI } from "...";
import pg from "pg";
```

if the project's architecture requires those dependencies to be hidden behind ports/adapters.

The concern is not simply "imports are ugly."

The concern is:

* Tight coupling
* Difficult testing
* Difficult provider replacement
* Violated dependency direction
* Harder evolution

---

# 20. Orchestrator Anti-Pattern

A common learner solution is:

```javascript
class MaintenanceWorkflowOrchestrator {
  async execute(input) {

    // retrieve documents

    // query database

    // call Gemini

    // parse response

    // validate response

    // apply safety rules

    // generate work order

    // save database records

    // send notifications

    // handle retries
  }
}
```

This becomes a **God Object**.

---

# 21. Better Design

The orchestrator should look conceptually like:

```javascript
class MaintenanceWorkflowOrchestrator {
  async execute(input) {

    const symptom =
      await this.symptomMatcher.execute(input);

    const history =
      await this.maintenanceHistory.execute({
        equipment: symptom.equipment,
        symptom: symptom.symptom
      });

    const plan =
      await this.diagnosticSafetyPlanner.execute({
        symptom,
        history
      });

    this.validateSafety(plan);

    await this.approvalGate.execute(...);

    return this.workOrderGenerator.execute(...);
  }
}
```

The orchestrator coordinates.

The individual components perform the specialized work.

---

# 22. Structured Contracts

A strong learner solution should define explicit contracts.

For example:

```text
SymptomMatch
├── equipment
├── symptom
└── confidence
```

```text
DiagnosticPlan
├── diagnosticSteps[]
└── safetyPrerequisites[]
```

```text
MaintenanceHistory
└── history[]
```

This prevents arbitrary strings from becoming hidden APIs between agents.

---

# 23. Why Validation Matters

The LLM is probabilistic.

The application should be deterministic where possible.

Recommended boundary:

```text
             Probabilistic
                  │
                  ▼
             ┌─────────┐
             │   LLM   │
             └────┬────┘
                  │
                  ▼
          Structured Output
                  │
                  ▼
             ┌─────────┐
             │  Zod   │
             └────┬────┘
                  │
                  ▼
        Deterministic Application
```

The schema acts as a contract.

---

# 24. Expected Tests

At minimum, the learner should add tests for:

### Test 1 — History Agent

```text
Given valid equipment
When history agent executes
Then structured history is returned
```

### Test 2 — Empty History

```text
Given equipment with no history
When history agent executes
Then history is []
```

### Test 3 — Safety Present

```text
Given safety prerequisites
When workflow reaches safety gate
Then workflow continues
```

### Test 4 — Safety Missing

```text
Given empty safety prerequisites
When workflow reaches safety gate
Then workflow stops
```

### Test 5 — Work Order Not Generated

```text
Given missing safety prerequisites
When workflow stops
Then work order generator is never called
```

### Test 6 — Transient Failure

```text
Given temporary provider failure
When workflow executes
Then bounded retry occurs
```

---

# 25. Common Incorrect Solutions

## Mistake 1 — Adding Everything to the Orchestrator

### Why it happens

The learner wants the implementation to be quick.

### Why it is a problem

The orchestrator becomes difficult to:

* Test
* Understand
* Modify
* Reuse

### Correction

Move specialized behavior into focused components.

---

## Mistake 2 — Treating Every Error as Retryable

### Incorrect

```javascript
catch (error) {
  retry();
}
```

### Why?

Some errors are deterministic or safety-related.

### Better

```text
Error
 ↓
Classify
 ├── transient → bounded retry
 ├── validation → fail
 ├── business rule → fail
 └── safety → stop
```

---

## Mistake 3 — Generating Missing Safety Instructions

### Incorrect

```text
No safety information
       ↓
Ask LLM to create safety instructions
```

### Why?

The system may fabricate critical information.

### Better

```text
No grounded safety information
       ↓
Stop workflow
```

---

# 26. Common Incorrect Solution — Too Many Agents

A learner may create:

```text
Equipment Agent
Symptom Agent
History Agent
Temperature Agent
Vibration Agent
Safety Agent
Priority Agent
Parts Agent
Duration Agent
Work Order Agent
```

This is not automatically better.

Ask:

> "What problem does each additional boundary solve?"

If the answer is unclear, the agent may not need to exist.

---

# 27. Common Incorrect Solution — Agent for Deterministic Logic

Example:

```text
SafetyPrerequisiteChecker Agent
       ↓
LLM
       ↓
"Is safety information present?"
```

This should normally be deterministic application logic.

If the rule is:

```javascript
safetyPrerequisites.length > 0
```

there is no reason to spend an LLM call deciding it.

---

# 28. Instructor Grading Rubric

Total: **10 points**

| Area                         | Points |
| ---------------------------- | -----: |
| Maintenance History Agent    |      2 |
| Structured input/output      |      1 |
| Correct workflow integration |      1 |
| Deterministic safety gate    |      2 |
| Failure classification       |      1 |
| Tests                        |      1 |
| Architecture compliance      |      1 |
| Stretch / reasoning          |      1 |

### Interpretation

The goal is not merely producing code.

A strong solution should demonstrate:

* Clear responsibilities
* Explicit contracts
* Safe failure behavior
* Architectural discipline

---

# 29. Instructor Discussion Questions

Use these after the exercise.

### Question 1

> "Would you actually add a Maintenance History Agent in production?"

Look for discussion around:

* Value
* Latency
* Data quality
* Complexity
* Retrieval alternatives

There is no requirement that more agents are always better.

---

### Question 2

> "Which rules should never be delegated to an LLM?"

Expected examples:

* Authorization
* Safety gates
* Required field validation
* Approval requirements
* Hard business constraints

---

### Question 3

> "Where should the system stop?"

Possible answers:

```text
Low confidence
Missing evidence
Missing safety information
Authorization failure
Repeated provider failure
Invalid structured output
```

---

### Question 4

> "What makes an agent boundary useful?"

Expected ideas:

* Clear responsibility
* Independent testing
* Explicit contract
* Replaceability
* Traceability
* Reduced cognitive complexity

---

# 30. Reference Architecture

The completed solution should conceptually preserve:

```text
┌───────────────────────────────────────────┐
│               Application                 │
│                                           │
│  ┌──────────────┐                         │
│  │ Orchestrator │                         │
│  └──────┬───────┘                         │
│         │                                 │
│    ┌────┼───────────────┬─────────────┐   │
│    ▼    ▼               ▼             ▼   │
│ Symptom History   Diagnostic/Safety Work │
│ Matcher  Agent       Planner       Order  │
│                              │            │
│                              ▼            │
│                         Safety Gate       │
└───────────────────────────────────────────┘
                 │
                 ▼
              Ports
                 │
                 ▼
          Infrastructure
```

---

# 31. Final Instructor Message

End the lab with this principle:

> **Good agentic architecture is not about making the system more autonomous. It is about making complex AI behavior easier to control, validate, observe, and evolve.**

The strongest implementation is not the one with the most agents.

It is the one where every component has a reason to exist.
