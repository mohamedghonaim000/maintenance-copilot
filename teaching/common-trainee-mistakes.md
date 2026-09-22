# Common Trainee Mistakes

## Multi-Agent Orchestration in an Industrial Maintenance System

### One-Page Reference for Trainees

---

# Mistake 1 — "Every Agent Must Call an LLM"

### Misconception

An agent is simply:

```text
Input
 ↓
LLM
 ↓
Output
```

### Correction

An agent is a specialized component responsible for a specific task.

It may perform:

* Retrieval
* Validation
* Transformation
* Decision logic
* Coordination
* LLM reasoning

Not every operation needs an LLM.

### Remember

> **Agent ≠ LLM call**

---

# Mistake 2 — "More Agents Means a Better System"

### Misconception

If three agents are useful, ten agents must be even better.

### Correction

Every additional agent can introduce:

* Latency
* Cost
* Failure points
* More state
* More debugging complexity
* More operational overhead

Example:

```text
One Agent
   ↓
Simple workflow

Ten Agents
   ↓
Many boundaries
   ↓
Many failure points
   ↓
More orchestration complexity
```

### Remember

> Create an agent because it solves a meaningful architectural problem, not because you can.

---

# Mistake 3 — "If the LLM Doesn't Know, Generate Something"

### Misconception

If required information is missing:

```text
Missing safety information
        ↓
Ask LLM for safety instructions
```

### Correction

For safety-critical information, missing evidence may require stopping the workflow.

Correct behavior:

```text
Missing safety evidence
        ↓
Deterministic safety rule
        ↓
STOP
```

The system should not silently convert missing evidence into fabricated instructions.

### Remember

> **Missing evidence is not permission to invent.**

---

# Mistake 4 — "The Orchestrator Should Do Everything"

### Misconception

The easiest place to implement new logic is inside the orchestrator.

Eventually it becomes:

```text
Orchestrator
├── Retrieval
├── Database access
├── LLM calls
├── Prompt construction
├── Validation
├── Safety rules
├── Retry logic
├── Work-order generation
└── Persistence
```

### Correction

The orchestrator should primarily coordinate.

Prefer:

```text
Orchestrator
├── Agent A
├── Agent B
├── Safety Gate
└── Agent C
```

Each component owns its specialized responsibility.

### Remember

> **Coordinate, don't centralize everything.**

---

# Mistake 5 — "Retries Solve Every Failure"

### Misconception

Whenever something fails:

```javascript
catch (error) {
  retry();
}
```

### Correction

First classify the failure.

| Failure                    | Typical Behavior     |
| -------------------------- | -------------------- |
| Temporary provider outage  | Retry                |
| Temporary network failure  | Retry                |
| Invalid schema             | Fail / bounded retry |
| Low-confidence result      | Stop                 |
| Missing safety information | Stop                 |
| Authorization failure      | Stop                 |

### Remember

> **Retryability is a property of the failure, not a property of the fact that an error occurred.**

---

# Quick Mental Model

Before adding code, ask five questions:

```text
1. What is this component responsible for?

2. Does it really need an LLM?

3. What is its input/output contract?

4. What happens if it fails?

5. What deterministic rules must be enforced?
```

If you can answer these five questions, you are probably designing the component for the right reason.

---

# Final Rule

> **Reliable agentic systems combine probabilistic reasoning with deterministic engineering.**

Use AI where reasoning is useful.

Use code where rules must be reliable.
