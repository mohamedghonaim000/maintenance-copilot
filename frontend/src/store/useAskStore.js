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
        turns.push({ id: message.id, question: message.content, answerText: '', citations: [], error: null, cost: null, costLoading: false, costError: null });
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
    (() => {
      const messageId = `local-${Date.now()}-${Math.random()}`;
      set((state) => ({
      isStreaming: true,
      statusMessage: '',
      messages: [
        ...state.messages,
        { id: messageId, question, answerText: '', citations: [], error: null, cost: null, costLoading: false, costError: null },
      ],
      }));
      return messageId;
    })(),

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

  setCostLoading: (messageId, costLoading) => set((state) => ({
    messages: state.messages.map((message) =>
      message.id === messageId ? { ...message, costLoading, costError: null } : message
    ),
  })),

  setCost: (messageId, cost) => set((state) => ({
    messages: state.messages.map((message) =>
      message.id === messageId ? { ...message, cost, costLoading: false, costError: null } : message
    ),
  })),

  setCostError: (messageId, costError) => set((state) => ({
    messages: state.messages.map((message) =>
      message.id === messageId ? { ...message, costLoading: false, costError } : message
    ),
  })),

  finishStreaming: () => set({ isStreaming: false }),

  stopStreaming: () => set((state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const hasEmptyAnswer = lastMessage && !lastMessage.answerText && !lastMessage.error;
    return {
      messages: hasEmptyAnswer ? state.messages.slice(0, -1) : state.messages,
      isStreaming: false,
      statusMessage: '',
    };
  }),

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