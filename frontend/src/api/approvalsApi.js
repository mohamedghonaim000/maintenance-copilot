import { getApiErrorMessage, httpClient } from './httpClient';

export async function decideApproval(token, approvalId, decision) {
  try {
    const response = await httpClient.post(
      `/approvals/${approvalId}/decide`,
      decision,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to record this decision.'), { cause: error });
  }
}

export async function fetchRunCost(token, runId) {
  try {
    const response = await httpClient.get(
      `/runs/${runId}/cost`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to load run cost.'), { cause: error });
  }
}