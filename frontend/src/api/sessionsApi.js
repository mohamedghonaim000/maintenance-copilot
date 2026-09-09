import { getApiErrorMessage, httpClient } from './httpClient';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function request(action, fallback) {
  try { 
    return (await action()).data; 
  } catch (error) { 
    throw new Error(getApiErrorMessage(error, fallback), { cause: error }); 
  }
}

export const fetchSessions = (token) => request(
  () => httpClient.get('/sessions', auth(token)), 
  'Unable to load sessions.'
);

export const createSession = (token, title) => request(
  () => httpClient.post('/sessions', title ? { title } : {}, auth(token)), 
  'Unable to create a session.'
);

export const fetchSessionRuns = (token, sessionId) => request(
  () => httpClient.get(`/sessions/${sessionId}/runs`, auth(token)), 
  'Unable to load session history.'
);

export const fetchSessionMessages = (token, sessionId) => request(
  () => httpClient.get(`/sessions/${sessionId}/messages`, auth(token)), 
  'Unable to load session messages.'
);

export const addSessionMessage = (token, sessionId, { runId, role, content }) => request(
  () => httpClient.post(`/sessions/${sessionId}/messages`, { runId, role, content }, auth(token)),
  'Unable to save session message.'
);

export const deleteSession = (token, sessionId) => request(
  () => httpClient.delete(`/sessions/${sessionId}`, auth(token)),
  'Unable to delete session.'
);