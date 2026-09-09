import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { fetchSessions, createSession, deleteSession } from "../api/sessionsApi";
import { useAuthStore } from "../store/useAuthStore";
import { useAskStore } from "../store/useAskStore";
import { useSessionsStore } from "../store/useSessionsStore";

const linkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-surface-hover text-text" : "text-text-muted hover:bg-surface-hover hover:text-text"}`;

export default function Sidebar() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const setSessionId = useAskStore((s) => s.setSessionId);
  const resetChat = useAskStore((s) => s.reset);
  const sessions = useSessionsStore((s) => s.sessions);
  const error = useSessionsStore((s) => s.error);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const setError = useSessionsStore((s) => s.setError);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    fetchSessions(token)
      .then((data) => {
        if (live) setSessions(data);
      })
      .catch((requestError) => {
        if (live) setError(requestError.message);
      });
    return () => {
      live = false;
    };
  }, [token, setError, setSessions]);

  async function newChat() {
    try {
      const session = await createSession(token, "New Chat");
      setSessions([session, ...sessions]);
      setActiveSession(session);
      resetChat();
      setSessionId(session.id);
      navigate("/ask");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeSession(session) {
    if (!window.confirm(`Delete ${session.title || "this chat"}?`)) return;
    try {
      await deleteSession(token, session.id);
      setSessions(sessions.filter((item) => item.id !== session.id));
      if (useAskStore.getState().sessionId === session.id) {
        resetChat();
      }
      navigate('/ask');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function selectSession(session) {
    setActiveSession(session);
    setSessionId(session.id);
    navigate(`/ask?sessionId=${session.id}`);
  }

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-border flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <button
          onClick={newChat}
          className="w-full px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium"
        >
          + New Chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <NavLink to="/" end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/ask" className={linkClass}>
          Ask a question
        </NavLink>
        <NavLink to="/workflow" className={linkClass}>
          Report an issue
        </NavLink>
        <NavLink to="/ingest" className={linkClass}>
          Ingest documents
        </NavLink>
        <p className="px-3 pt-4 pb-2 text-xs text-text-muted uppercase tracking-wide">
          Recent chats
        </p>
        {error && <p className="px-3 text-xs text-danger">{error}</p>}
        {sessions.map((session) => (
          <div
            key={session.id}
            className="group flex items-center gap-1 rounded-lg hover:bg-surface-hover"
          >
            <button
              onClick={() => selectSession(session)}
              className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-text-muted hover:text-text"
            >
              {session.title || "Untitled chat"}
              <span className="block text-xs opacity-70">
                {session.created_at ? new Date(session.created_at).toLocaleString() : ""}
              </span>
            </button>
            <button
              onClick={() => removeSession(session)}
              className="mr-2 hidden rounded px-2 py-1 text-xs text-danger group-hover:block"
              aria-label={`Delete ${session.title || "chat"}`}
            >
              Delete
            </button>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="text-sm text-text-muted hover:text-text"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}