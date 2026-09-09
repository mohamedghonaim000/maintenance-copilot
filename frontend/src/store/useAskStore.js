import { create } from 'zustand';

export const useAskStore = create((set) => ({
  messages: [], // array of { question, answerText, citations, error }
  isStreaming: false,
  statusMessage: '',
  sessionId: null,

  setSessionId: (sessionId) => set({ sessionId }),

  loadMessages: (messages) => set({
    messages: messages.reduce((turns, message) => {
      if (message.role === 'user') {
        turns.push({ id: message.id, question: message.content, answerText: '', citations: [], error: null });
      } else if (message.role === 'assistant' && turns.length > 0) {
        turns[turns.length - 1] = { ...turns[turns.length - 1], answerText: message.content };
      }
      return turns;
    }, []),
    isStreaming: false,
    statusMessage: '',
  }),

  // Adds a new question at the end of history, and starts streaming
  // into it. This is the key fix: previous messages stay in the array
  // untouched, only the new one is being built up.
  startStreaming: (question) =>
    set((state) => ({
      isStreaming: true,
      statusMessage: '',
      messages: [
        ...state.messages,
        { question, answerText: '', citations: [], error: null },
      ],
    })),

  // Appends a chunk to the LAST message only — the one currently streaming.
  appendChunk: (chunk) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      messages[lastIndex] = {
        ...messages[lastIndex],
        answerText: messages[lastIndex].answerText + chunk,
      };
      return { messages };
    }),

  setCitations: (citations) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      messages[lastIndex] = { ...messages[lastIndex], citations };
      return { messages };
    }),

  setStatusMessage: (statusMessage) => set({ statusMessage }),

  finishStreaming: () => set({ isStreaming: false }),

  // Error also attaches to the last (current) message, not a global field
  setError: (error) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0) {
        messages[lastIndex] = { ...messages[lastIndex], error };
      }
      return { messages, isStreaming: false };
    }),

  reset: () => set({ messages: [], isStreaming: false, statusMessage: '', sessionId: null }),
}));