import { useRef, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAskStore } from '../store/useAskStore';
import { streamAsk } from '../api/askApi';
import { createSession, fetchSessionMessages } from '../api/sessionsApi';
import { useAuthStore } from '../store/useAuthStore';

export default function AskPage() {
  const {
    messages,
    isStreaming,
    statusMessage,
    startStreaming,
    appendChunk,
    setCitations,
    finishStreaming,
    setError,
    setStatusMessage,
    loadMessages,
  } = useAskStore();
  const sessionId = useAskStore((state) => state.sessionId);
  const token = useAuthStore((state) => state.token);
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('sessionId');

  const [localQuestion, setLocalQuestion] = useState('');
  const cancelRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!requestedSessionId) return undefined;
    let live = true;
    fetchSessionMessages(token, requestedSessionId)
      .then((savedMessages) => {
        if (live) loadMessages(savedMessages);
      })
      .catch((error) => {
        if (live) setError(error.message);
      });
    return () => {
      live = false;
    };
  }, [requestedSessionId, token, loadMessages, setError]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!localQuestion.trim() || isStreaming) return;

    const questionText = localQuestion;
    setLocalQuestion('');
    let activeSessionId = sessionId;
    try {
      if (!activeSessionId) {
        const session = await createSession(token, questionText.slice(0, 80));
        activeSessionId = session.id;
        useAskStore.getState().setSessionId(activeSessionId);
      }

      startStreaming(questionText);
    } catch (error) {
      setError(error.message);
      return;
    }

    cancelRef.current = streamAsk(
      { question: questionText, sessionId: activeSessionId, token },
      {
        onChunk: appendChunk,
        onCitations: setCitations,
        onDone: async () => {
          finishStreaming();
        },
        onError: setError,
        onStatus: setStatusMessage,
      }
    );
  }

  function handleStop() {
    cancelRef.current?.();
    finishStreaming();
  }

  const hasContent = messages.length > 0;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">
        {!hasContent ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <h1 className="text-2xl font-semibold text-text mb-2">
              What's the issue you're diagnosing?
            </h1>
            <p className="text-text-muted text-sm">
              Ask about equipment symptoms, manuals, or safety procedures.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              return (
                <div key={index} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-accent text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
                      {msg.question}
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.error ? (
                        <span className="text-danger">{msg.error}</span>
                      ) : (
                        <>
                          {msg.answerText}
                          {isLast && isStreaming && !msg.answerText && (
                            <span className="inline-flex items-center gap-1 text-text-muted" aria-label="Working">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:-0.2s]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:-0.1s]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce" />
                            </span>
                          )}
                        </>
                      )}

                      {isLast && isStreaming && statusMessage && (
                        <p className="mt-2 text-xs text-text-muted" aria-live="polite">{statusMessage}</p>
                      )}

                      {msg.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-text-muted mb-1.5 font-medium">Sources</p>
                          <ul className="space-y-1">
                            {msg.citations.map((c, i) => (
                              <li key={i} className="text-xs text-text-muted">
                                <span className="text-accent font-medium">[{c.sourceIndex}]</span>{' '}
                                {c.documentTitle}
                                {c.section && ` — ${c.section}`}
                                {c.manualVersion && ` (v${c.manualVersion})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-bg px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl px-3 py-2 focus-within:border-accent transition-colors">
            <textarea
              value={localQuestion}
              onChange={(e) => setLocalQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Describe the symptom or ask about a manual…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 placeholder:text-text-muted disabled:opacity-50"
            />
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