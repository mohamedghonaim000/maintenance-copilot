import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchSessionMessages, fetchSessionRuns } from "../api/sessionsApi";
import { useAuthStore } from "../store/useAuthStore";
import { useSessionsStore } from "../store/useSessionsStore";

export default function SessionHistoryPage() {
  const { sessionId } = useParams();
  const token = useAuthStore((s) => s.token);
  const sessions = useSessionsStore((s) => s.sessions);
  const [messages, setMessages] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    
    const fetchData = async () => {
      try {
        const [messagesData, runsData] = await Promise.all([
          fetchSessionMessages(token, sessionId),
          fetchSessionRuns(token, sessionId)
        ]);
        
        if (live) {
          setMessages(messagesData || []);
          setRuns(runsData || []);
        }
      } catch (requestError) {
        if (live) setError(requestError.message);
      } finally {
        if (live) setLoading(false);
      }
    };

    fetchData();

    return () => {
      live = false;
    };
  }, [token, sessionId]);

  const session = sessions.find((item) => item.id === sessionId);

  function getStatusBadge(status) {
    const statusMap = {
      'completed': 'bg-green-100 text-green-700 border-green-200',
      'failed': 'bg-red-100 text-red-700 border-red-200',
      'awaiting_approval': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'in_progress': 'bg-blue-100 text-blue-700 border-blue-200',
      'pending': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return statusMap[status] || statusMap.pending;
  }

  function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString();
  }

  function getRoleLabel(role) {
    const roleMap = {
      'user': 'You',
      'assistant': 'Assistant',
      'system': 'System',
      'tool': 'Tool'
    };
    return roleMap[role] || role;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Chat History</h1>
      <p className="mt-1 text-sm text-text-muted">
        {session?.title || sessionId}
      </p>

      {loading && <p className="mt-6 text-sm text-text-muted">Loading messages…</p>}

      {error && (
        <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="mt-6 space-y-6">
          {/* Messages section */}
          <div>
            <h2 className="text-sm font-medium text-text-muted mb-3">Messages</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-text-muted">No messages in this chat yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`rounded-xl border border-border p-4 ${
                      msg.role === 'user' ? 'bg-accent/5' : 'bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-muted">
                        {getRoleLabel(msg.role)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Runs section */}
          <div>
            <h2 className="text-sm font-medium text-text-muted mb-3">Workflow Runs</h2>
            {runs.length === 0 ? (
              <p className="text-sm text-text-muted">No runs in this session yet.</p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <details
                    key={run.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      <span className="flex items-center gap-2">
                        {run.workflow_type || "Workflow"}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusBadge(run.status)}`}>
                          {run.status || "unknown"}
                        </span>
                      </span>
                    </summary>
                    <dl className="mt-3 space-y-1 text-sm text-text-muted">
                      <div>
                        <dt className="inline">Created: </dt>
                        <dd className="inline">{formatDate(run.created_at)}</dd>
                      </div>
                      {run.completed_at && (
                        <div>
                          <dt className="inline">Completed: </dt>
                          <dd className="inline">{formatDate(run.completed_at)}</dd>
                        </div>
                      )}
                      {run.error && (
                        <div className="text-red-500">
                          <dt className="inline">Error: </dt>
                          <dd className="inline">{run.error}</dd>
                        </div>
                      )}
                    </dl>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}