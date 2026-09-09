import { getApiErrorMessage, httpClient } from './httpClient';

async function request(path, data) {
  try {
    const response = await httpClient.post(path, data);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error), { cause: error });
  }
}

export const login = (email, password) =>
  request('/auth/login', { email, password });

export const register = (email, password, role) =>
  request('/auth/register', { email, password, role });
