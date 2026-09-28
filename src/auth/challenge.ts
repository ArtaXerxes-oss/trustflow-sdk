import { createApiHttpClient } from '../utils/http';
import type { HttpInterceptors } from '../utils/interceptors';
import { TrustFlowError } from '../errors';

export interface AuthChallenge {
  challenge: string;
  expiresAt: number;
  address: string;
}

export interface AuthRequestOptions {
  timeoutMs?: number;
  /** Request/response interceptor hooks applied to auth API calls. */
  interceptors?: HttpInterceptors;
}

/**
 * Requests a signing challenge from the TrustFlow backend.
 *
 * Transient backend failures are automatically retried with exponential backoff.
 */
export async function requestChallenge(
  apiUrl: string,
  address: string,
  options: AuthRequestOptions = {},
): Promise<AuthChallenge> {
  const http = createApiHttpClient({
    baseURL: apiUrl,
    timeoutMs: options.timeoutMs,
    interceptors: options.interceptors,
  });
  try {
    const response = await http.get<{ challenge: string }>('/auth/challenge', {
      params: { address },
    });
    return { challenge: response.data.challenge, expiresAt: Date.now() + 60_000, address };
  } catch (error) {
    throw new TrustFlowError('Failed to get challenge', 'CONNECTION_ERROR', error);
  }
}

/**
 * Verifies a signature and exchanges it for a backend session token.
 *
 * Transient backend failures are automatically retried with exponential backoff.
 */
export async function verifyAndGetToken(
  apiUrl: string,
  address: string,
  signature: string,
  options: AuthRequestOptions = {},
): Promise<string> {
  const http = createApiHttpClient({
    baseURL: apiUrl,
    timeoutMs: options.timeoutMs,
    interceptors: options.interceptors,
  });
  try {
    const response = await http.post<{ token: string }>('/auth/verify', { address, signature });
    return response.data.token;
  } catch (error) {
    throw new TrustFlowError('Signature verification failed', 'UNAUTHORIZED', error);
  }
}
