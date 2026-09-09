import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runWorkflow } from "../api/workflowApi";
import { useAuthStore } from "../store/useAuthStore";
import { useAskStore } from "../store/useAskStore";
import { useApprovalsStore } from "../store/useApprovalsStore";

export default function WorkflowPage() {
  const [symptom, setSymptom] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);
  const sessionId = useAskStore((s) => s.sessionId);
  const navigate = useNavigate();
  const setApproval = useApprovalsStore((s) => s.setApproval);

  async function submit(event) {
    event.preventDefault();
    if (!symptom.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await runWorkflow(token, symptom.trim(), sessionId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const workOrder = result?.proposedWorkOrder;
  const approvalId = result?.approvalId ?? result?.approval?.id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Maintenance workflow</h1>
      <p className="text-sm text-text-muted mt-2">
        Describe the symptom to generate a proposed work order.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <textarea
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          rows={5}
          required
          placeholder="Describe the equipment issue…"
          className="w-full bg-surface border border-border rounded-xl p-3 text-sm outline-none focus:border-accent resize-y"
        />
        <button
          disabled={submitting || !symptom.trim()}
          className="rounded-lg bg-accent hover:bg-accent-dim disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {submitting ? "Running workflow…" : "Run workflow"}
        </button>
      </form>
      {error && (
        <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {result && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Proposed work order</h2>
            <span className="rounded-full bg-accent-dim px-2.5 py-1 text-xs">
              {result.status ?? "complete"}
            </span>
          </div>
          {workOrder && (
            <div className="mt-4 text-sm space-y-3">
              <p>
                <span className="text-text-muted">Equipment:</span>{" "}
                {workOrder.equipmentId ?? "—"}
              </p>
              <p className="whitespace-pre-wrap">
                {workOrder.summary ?? workOrder.description}
              </p>
            </div>
          )}
          {result.status === "awaiting_approval" && approvalId && (
            <button
              onClick={() => {
                setApproval(result);
                navigate(`/approvals/${approvalId}`, { state: result });
              }}
              className="mt-5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Review & approve
            </button>
          )}
        </section>
      )}
    </div>
  );
}
