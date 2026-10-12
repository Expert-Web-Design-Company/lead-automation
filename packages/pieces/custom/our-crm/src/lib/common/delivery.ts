import { HttpError } from '@activepieces/pieces-common';

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

async function withRetries<T>({ send }: { send: () => Promise<T> }): Promise<{ result: T; attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return { result: await send(), attempts: attempt };
    }
    catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === 'permanent') {
        throw new Error(failure.message);
      }
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`${failure.message} Gave up after ${attempt} attempts; the lead was not delivered.`);
      }
      await deliveryInternals.sleep(backoffDelayMs(attempt));
    }
  }
}

function classifyFailure(error: unknown): DeliveryFailure {
  if (error instanceof PermanentDeliveryError) {
    return { kind: 'permanent', message: error.message };
  }
  if (!(error instanceof HttpError)) {
    return { kind: 'retryable', message: 'Could not reach the CRM (network error or timeout).' };
  }
  const status = error.response.status;
  const detail = extractCrmMessage(error.response.body);
  if (status === 401 || status === 403) {
    return { kind: 'permanent', message: 'The CRM rejected the API key. Open the CRM connection and update the key.' };
  }
  if (status === 404) {
    return { kind: 'permanent', message: 'The CRM lead endpoint was not found. Check the CRM URL in the connection.' };
  }
  if (PERMANENT_STATUSES.has(status)) {
    return {
      kind: 'permanent',
      message: `The CRM refused this lead (HTTP ${status})${detail ? `: ${detail}` : ''}. Fix the field mapping, then resend the lead.`,
    };
  }
  if (status === 429) {
    return { kind: 'retryable', message: 'The CRM is rate-limiting requests (HTTP 429).' };
  }
  if (status >= 500) {
    return { kind: 'retryable', message: `The CRM had a server error (HTTP ${status}).` };
  }
  return { kind: 'retryable', message: `Unexpected CRM response (HTTP ${status}).` };
}

function extractCrmMessage(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return body.slice(0, 300) || undefined;
  }
  if (body !== null && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      if (['message', 'error', 'detail'].includes(key) && typeof value === 'string' && value.length > 0) {
        return value.slice(0, 300);
      }
    }
  }
  return undefined;
}

function backoffDelayMs(attempt: number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(Math.random() * ceiling);
}

export class PermanentDeliveryError extends Error {}

export const delivery = { withRetries, classifyFailure };

export const deliveryInternals = {
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),
  MAX_ATTEMPTS,
};

type DeliveryFailure = {
  kind: 'permanent' | 'retryable';
  message: string;
};
