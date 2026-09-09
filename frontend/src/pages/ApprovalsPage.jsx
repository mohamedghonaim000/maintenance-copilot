import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { decideApproval } from "../api/approvalsApi";
import { useAuthStore } from "../store/useAuthStore";
import { useApprovalsStore } from "../store/useApprovalsStore";

const toLines = (value) =>
  Array.isArray(value) ? value.join("\n") : (value ?? "");
const toList = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

function WorkOrderList({ title, items }) {
  return (
    <section>
      <h2 className="text-sm font-medium">{title}</h2>
      <ol className="mt-2 space-y-2 text-sm text-text-muted list-decimal list-inside">
        {(items ?? []).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

export default function ApprovalsPage() {
  const { approvalId } = useParams();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const approval = useApprovalsStore((s) => s.approval);
  const isSubmitting = useApprovalsStore((s) => s.isSubmitting);
  const error = useApprovalsStore((s) => s.error);
  const setSubmitting = useApprovalsStore((s) => s.setSubmitting);
  const setError = useApprovalsStore((s) => s.setError);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const order = approval?.proposedWorkOrder;
  const [safety, setSafety] = useState(() =>
    toLines(order?.safetyPrerequisites),
  );
  const [steps, setSteps] = useState(() => toLines(order?.diagnosticSteps));

  async function record(decision) {
    setSubmitting(true);
    setError(null);
    try {
      const editedAction =
        decision === "edited_and_approved"
          ? {
              ...order,
              safetyPrerequisites: toList(safety),
              diagnosticSteps: toList(steps),
            }
          : undefined;
      await decideApproval(token, approvalId, {
        decision,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(editedAction ? { editedAction } : {}),
      });
      setRecorded(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (role !== "supervisor")
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-text-muted">
          Only supervisors can approve work orders.
        </div>
      </div>
    );
  if (!order)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
          No approval loaded. Start from a workflow run.
        </div>
      </div>
    );
  if (recorded)
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-success text-4xl">✓</div>
        <h1 className="mt-3 text-xl font-semibold">Decision recorded</h1>
        <Link
          to="/workflow"
          className="inline-block mt-5 rounded-lg bg-accent px-4 py-2 text-sm text-white"
        >
          Back to workflow
        </Link>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Work order approval</h1>
            <p className="mt-1 text-sm text-text-muted">
              {order.equipmentId ?? "Equipment not specified"}{" "}
              {order.manualVersion && `• Manual v${order.manualVersion}`}
            </p>
          </div>
          <span className="rounded-full bg-accent-dim px-2.5 py-1 text-xs">
            {approval.status ?? "awaiting approval"}
          </span>
        </div>
        <div className="mt-6 space-y-5">
          {editing ? (
            <>
              <label className="block text-sm font-medium">
                Safety prerequisites
                <textarea
                  value={safety}
                  onChange={(e) => setSafety(e.target.value)}
                  rows={4}
                  className="mt-2 w-full bg-bg border border-border rounded-lg p-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm font-medium">
                Diagnostic steps
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  rows={6}
                  className="mt-2 w-full bg-bg border border-border rounded-lg p-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </>
          ) : (
            <>
              <WorkOrderList
                title="Safety prerequisites"
                items={order.safetyPrerequisites}
              />
              <WorkOrderList
                title="Diagnostic steps"
                items={order.diagnosticSteps}
              />
            </>
          )}
        </div>
        <label className="block mt-6 text-sm font-medium">
          Comment{" "}
          <span className="text-text-muted font-normal">(optional)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-2 w-full bg-bg border border-border rounded-lg p-3 text-sm outline-none focus:border-accent"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {editing ? (
            <>
              <button
                disabled={isSubmitting}
                onClick={() => record("edited_and_approved")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Confirm edit & approve"}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel edit
              </button>
            </>
          ) : (
            <>
              <button
                disabled={isSubmitting}
                onClick={() => record("approved")}
                className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => record("rejected")}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Reject
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => setEditing(true)}
                className="rounded-lg border border-accent px-4 py-2 text-sm text-accent"
              >
                Edit & approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
