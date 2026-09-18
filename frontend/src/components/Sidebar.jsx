import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  fetchSessions,
  createSession,
  deleteSession,
} from "../api/sessionsApi";

import { useAuthStore } from "../store/useAuthStore";
import { useAskStore } from "../store/useAskStore";
import { useSessionsStore } from "../store/useSessionsStore";

const linkClass = ({ isActive }) =>
  `flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? "bg-surface-hover text-text"
      : "text-text-muted hover:bg-surface-hover hover:text-text"
  }`;

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

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
        if (live) {
          setSessions(data);
        }
      })
      .catch((requestError) => {
        if (live) {
          setError(requestError.message);
        }
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
    if (!window.confirm(`Delete ${session.title || "this chat"}?`)) {
      return;
    }

    try {
      await deleteSession(token, session.id);

      setSessions(
        sessions.filter((item) => item.id !== session.id)
      );

      if (useAskStore.getState().sessionId === session.id) {
        resetChat();
      }

      navigate("/ask");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function selectSession(session) {
    setActiveSession(session);
    setSessionId(session.id);

    navigate(`/ask?sessionId=${session.id}`);
  }

  function toggleSidebar() {
    setCollapsed((current) => !current);
  }

  return (
    <aside
      className={`
        ${
          collapsed ? "w-16" : "w-64"
        }
        shrink-0
        bg-surface
        border-r
        border-border
        flex
        flex-col
        h-screen
        transition-all
        duration-300
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className="p-3 border-b border-border">
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="
            w-full
            flex
            items-center
            justify-center
            rounded-lg
            px-3
            py-2
            text-text-muted
            hover:bg-surface-hover
            hover:text-text
            transition-colors
          "
          aria-label={
            collapsed ? "Open sidebar" : "Close sidebar"
          }
        >
          {collapsed ? "→" : "←"}
        </button>

        {/* New Chat */}
        {!collapsed && (
          <button
            onClick={newChat}
            className="
              w-full
              mt-2
              px-3
              py-2
              rounded-lg
              bg-accent
              text-white
              text-sm
              font-medium
              hover:opacity-90
              transition-opacity
            "
          >
            + New Chat
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-scrollbar flex-1 overflow-y-auto p-2 space-y-1">
        {/* Dashboard */}
        <NavLink
          to="/"
          end
          className={linkClass}
          title={collapsed ? "Dashboard" : undefined}
        >
          <span className="w-full text-center">
            {collapsed ? "⌂" : "Dashboard"}
          </span>
        </NavLink>

        {/* Ask */}
        <NavLink
          to="/ask"
          className={linkClass}
          title={collapsed ? "Ask a question" : undefined}
        >
          <span className="w-full text-center">
            {collapsed ? "?" : "Ask a question"}
          </span>
        </NavLink>

        {/* Workflow */}
        <NavLink
          to="/workflow"
          className={linkClass}
          title={collapsed ? "Report an issue" : undefined}
        >
          <span className="w-full text-center">
            {collapsed ? "!" : "Report an issue"}
          </span>
        </NavLink>

        {/* Ingest */}
        <NavLink
          to="/ingest"
          className={linkClass}
          title={collapsed ? "Ingest documents" : undefined}
        >
          <span className="w-full text-center">
            {collapsed ? "↑" : "Ingest documents"}
          </span>
        </NavLink>

        {/* Recent Chats */}
        {!collapsed && (
          <p className="px-3 pt-4 pb-2 text-xs text-text-muted uppercase tracking-wide">
            Recent chats
          </p>
        )}

        {/* Error */}
        {error && !collapsed && (
          <p className="px-3 text-xs text-danger">
            {error}
          </p>
        )}

        {/* Sessions */}
        {sessions.map((session) => (
          <div
            key={session.id}
            className="
              group
              flex
              items-center
              gap-1
              rounded-lg
              hover:bg-surface-hover
            "
          >
            <button
              onClick={() => selectSession(session)}
              className="
                min-w-0
                flex-1
                px-3
                py-2
                text-left
                text-sm
                text-text-muted
                hover:text-text
                transition-colors
              "
              title={
                collapsed
                  ? session.title || "Untitled chat"
                  : undefined
              }
            >
              {collapsed ? (
                <span className="block text-center">
                  💬
                </span>
              ) : (
                <>
                  <span className="block truncate">
                    {session.title || "Untitled chat"}
                  </span>

                  <span className="block text-xs opacity-70 truncate">
                    {session.created_at
                      ? new Date(
                          session.created_at
                        ).toLocaleString()
                      : ""}
                  </span>
                </>
              )}
            </button>

            {/* Delete */}
            {!collapsed && (
              <button
                onClick={() => removeSession(session)}
                className="
                  mr-2
                  hidden
                  rounded
                  px-2
                  py-1
                  text-xs
                  text-danger
                  group-hover:block
                "
                aria-label={`Delete ${
                  session.title || "chat"
                }`}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="
            w-full
            rounded-lg
            px-3
            py-2
            text-sm
            text-text-muted
            hover:bg-surface-hover
            hover:text-text
            transition-colors
          "
          title={collapsed ? "Logout" : undefined}
        >
          {collapsed ? "↪" : "Logout"}
        </button>
      </div>
    </aside>
  );
}