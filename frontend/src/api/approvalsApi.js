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
