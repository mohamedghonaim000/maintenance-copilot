import { useRef, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAskStore } from "../store/useAskStore";
import { streamAsk } from "../api/askApi";
import { fetchRunCost } from "../api/approvalsApi";
import {
  createSession,
  fetchSessionMessages,
} from "../api/sessionsApi";
import { useAuthStore } from "../store/useAuthStore";

export default function AskPage() {
  const {
    messages,
    isStreaming,
    statusMessage,
    startStreaming,
    appendChunk,
    setCitations,
    finishStreaming,
    stopStreaming,
    setError,
    setStatusMessage,
    setCostLoading,
    setCost,
    setCostError,
    loadMessages,
  } = useAskStore();

  const sessionId = useAskStore((state) => state.sessionId);
  const token = useAuthStore((state) => state.token);

  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");

  const [localQuestion, setLocalQuestion] = useState("");

  const cancelRef = useRef(null);
  const bottomRef = useRef(null);

  // Scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // Load an existing session
  useEffect(() => {
    if (!requestedSessionId) return undefined;

    let live = true;

    fetchSessionMessages(token, requestedSessionId)
      .then((savedMessages) => {
        if (live) {
          loadMessages(savedMessages);
        }
      })
      .catch((error) => {
        if (live) {
          setError(error.message);
        }
      });

    return () => {
      live = false;
    };
  }, [
    requestedSessionId,
    token,
    loadMessages,
    setError,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!localQuestion.trim() || isStreaming) {
      return;
    }

    const questionText = localQuestion.trim();

    setLocalQuestion("");

    let activeSessionId = sessionId;
    let messageId;

    try {
      // Create a session if this is the first question
      if (!activeSessionId) {
        const session = await createSession(
          token,
          questionText.slice(0, 80)
        );

        activeSessionId = session.id;

        useAskStore
          .getState()
          .setSessionId(activeSessionId);
      }

      // Add the user question and prepare the assistant message
      messageId = startStreaming(questionText);
    } catch (error) {
      setError(error.message);
      return;
    }

    // Start streaming the answer
    cancelRef.current = streamAsk(
      {
        question: questionText,
        sessionId: activeSessionId,
        token,
      },
      {
        onChunk: appendChunk,

        onCitations: setCitations,

        onDone: async (data) => {
          finishStreaming();

          const runId =
            data?.runId ??
            data?.run_id ??
            data?.run?.id;

          if (!runId) {
            return;
          }

          // Load run cost after streaming finishes
          setCostLoading(messageId, true);

          try {
            const cost = await fetchRunCost(
              token,
              runId
            );

            setCost(messageId, cost);
          } catch (error) {
            setCostError(
              messageId,
              error.message
            );
          }
        },

        onError: setError,

        onStatus: setStatusMessage,
      }
    );
  }

  function handleStop() {
    cancelRef.current?.();
    stopStreaming();
  }

  const hasContent = messages.length > 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!hasContent ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-3xl font-semibold text-text">
              Welcome to Industrial Maintenance Copilot
            </h1>

            <h2 className="mt-2 text-2xl font-semibold text-text">
              How can I help you today?
            </h2>

            <p className="mt-3 text-text-muted">
              Ask about equipment symptoms, manuals, or
              safety procedures.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg, index) => {
              const isLast =
                index === messages.length - 1;

              return (
                <div
                  key={index}
                  className="space-y-3"
                >
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-accent text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
                      {msg.question}
                    </div>
                  </div>

                  {/* Assistant message */}
                  <div className="flex justify-start">
                    <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
                      {/* Error */}
                      {msg.error ? (
                        <span className="text-danger">
                          {msg.error}
                        </span>
                      ) : (
                        <>
                          {/* Answer */}
                          {msg.answerText}

                          {/* Streaming indicator */}
                          {isLast &&
                            isStreaming &&
                            !msg.answerText && (
                              <span
                                className="inline-flex items-center gap-1 text-text-muted"
                                aria-label="Working"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:-0.2s]" />

                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:-0.1s]" />

                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce" />
                              </span>
                            )}
                        </>
                      )}

                      {/* Status message */}
                      {isLast &&
                        isStreaming &&
                        statusMessage && (
                          <p
                            className="mt-2 text-xs text-text-muted"
                            aria-live="polite"
                          >
                            {statusMessage}
                          </p>
                        )}

                      {/* Citations */}
                      {msg.citations?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-text-muted mb-1.5 font-medium">
                            Sources
                          </p>

                          <ul className="space-y-1">
                            {msg.citations.map(
                              (citation, citationIndex) => (
                                <li
                                  key={citationIndex}
                                  className="text-xs text-text-muted"
                                >
                                  <span className="text-accent font-medium">
                                    [{citation.sourceIndex}]
                                  </span>{" "}

                                  {citation.documentTitle}

                                  {citation.section &&
                                    ` — ${citation.section}`}

                                  {citation.manualVersion &&
                                    ` (v${citation.manualVersion})`}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Run cost */}
                      {(msg.costLoading ||
                        msg.costError ||
                        msg.cost) && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-text-muted mb-1.5 font-medium">
                            Run cost
                          </p>

                          {/* Loading */}
                          {msg.costLoading && (
                            <p className="text-xs text-text-muted">
                              Loading cost breakdown…
                            </p>
                          )}

                          {/* Error */}
                          {msg.costError && (
                            <p className="text-xs text-danger">
                              {msg.costError}
                            </p>
                          )}

                          {/* Cost */}
                          {msg.cost && (
                            <>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                                <span>
                                  Tokens:{" "}
                                  {msg.cost.totalTokens ?? 0}
                                </span>

                                <span>
                                  Cost: $
                                  {(
                                    msg.cost
                                      .totalCostUsd ?? 0
                                  ).toFixed(6)}
                                </span>
                              </div>

                              {/* Cost breakdown */}
                              {msg.cost.breakdown
                                ?.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs text-text-muted">
                                  {msg.cost.breakdown.map(
                                    (
                                      item,
                                      costIndex
                                    ) => (
                                      <li
                                        key={`${item.agentName}-${costIndex}`}
                                      >
                                        {item.agentName ??
                                          "Unknown agent"}
                                        :{" "}
                                        {item.tokens ??
                                          0}{" "}
                                        tokens, $
                                        {(
                                          item.costUsd ??
                                          0
                                        ).toFixed(6)}
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-bg px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto"
        >
          <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl px-3 py-2 focus-within:border-accent transition-colors">
            <textarea
              value={localQuestion}
              onChange={(e) =>
                setLocalQuestion(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Describe the symptom or ask about a manual…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 placeholder:text-text-muted disabled:opacity-50"
            />

            {/* Stop button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-danger hover:opacity-90 text-white transition-opacity"
                aria-label="Stop"
              >
                ■
              </button>
            ) : (
              /* Send button */
              <button
                type="submit"
                disabled={!localQuestion.trim()}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent hover:bg-accent-dim disabled:opacity-30 disabled:hover:bg-accent text-white transition-colors"
                aria-label="Send"
              >
                ↑
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}