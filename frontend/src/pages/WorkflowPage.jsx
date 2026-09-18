import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRunCost } from "../api/approvalsApi";
import { runWorkflow } from "../api/workflowApi";
import { useAuthStore } from "../store/useAuthStore";
import { useAskStore } from "../store/useAskStore";
import { useApprovalsStore } from "../store/useApprovalsStore";

export default function WorkflowPage() {
  const [symptom, setSymptom] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cost, setCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState(null);
  const token = useAuthStore((s) => s.token);
  const sessionId = useAskStore((s) => s.sessionId);
  const navigate = useNavigate();
  const setApproval = useApprovalsStore((s) => s.setApproval);

  const runId = result?.runId ?? result?.run?.id ?? result?.id;

  async function submit(event) {
    event.preventDefault();
    if (!symptom.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setCost(null);
    setCostLoading(false);
    setCostError(null);
    try {
      const workflowResult = await runWorkflow(token, symptom.trim(), sessionId);
      setResult(workflowResult);

      const workflowRunId = workflowResult?.runId ?? workflowResult?.run?.id ?? workflowResult?.id;
      if (workflowRunId) {
        setCostLoading(true);
        fetchRunCost(token, workflowRunId)
          .then(setCost)
          .catch((requestError) => setCostError(requestError.message))
          .finally(() => setCostLoading(false));
      }
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
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Run cost</h3>
            {costLoading && (
              <p className="mt-2 text-sm text-text-muted">Loading cost breakdown…</p>
            )}
            {costError && (
              <p className="mt-2 text-sm text-danger">{costError}</p>
            )}
            {!costLoading && !costError && cost && (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-text-muted">Total tokens</dt>
                    <dd className="mt-1 font-medium">{cost.totalTokens ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Total cost</dt>
                    <dd className="mt-1 font-medium">
                      ${(cost.totalCostUsd ?? 0).toFixed(6)}
                    </dd>
                  </div>
                </dl>
                {cost.breakdown?.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-text-muted">
                        <tr>
                          <th className="pb-2 font-medium">Agent</th>
                          <th className="pb-2 font-medium">Tokens</th>
                          <th className="pb-2 text-right font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cost.breakdown.map((item, index) => (
                          <tr key={`${item.agentName}-${index}`} className="border-t border-border">
                            <td className="py-2">{item.agentName ?? "Unknown agent"}</td>
                            <td className="py-2">{item.tokens ?? 0}</td>
                            <td className="py-2 text-right">${(item.costUsd ?? 0).toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {!costLoading && !costError && !cost && !runId && (
              <p className="mt-2 text-sm text-text-muted">Cost is unavailable for this run.</p>
            )}
          </div>
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
