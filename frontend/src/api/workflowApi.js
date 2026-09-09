import { getApiErrorMessage, httpClient } from './httpClient';

export async function runWorkflow(token, symptom, sessionId) {
  try {
    const response = await httpClient.post(
      '/workflow/run',
      { symptomDescription: symptom, sessionId },
      { headers: token ? { Authorization: 'Bearer ' + token } : undefined }
    );
    console.log(response.data);
    
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error), { cause: error });
  }
}
