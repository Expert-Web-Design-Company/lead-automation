import { AppConnectionType } from '@activepieces/pieces-framework';
import { vi } from 'vitest';
import { deliveryInternals } from '../src/lib/common/delivery';

export const BASE_URL = 'https://crm.test';

export function crmAuth() {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: { base_url: `${BASE_URL}/`, api_key: 'KEY-123', tenant_id: 'abic' },
  };
}

// Stubs global fetch with a scripted CRM. Each route reply may be a list, consumed in order.
export function stubCrm(routes: Route[]): Seen[] {
  const seen: Seen[] = [];
  vi.spyOn(deliveryInternals, 'sleep').mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = (init?.method ?? 'GET').toUpperCase();
      const rawBody = typeof init?.body === 'string' ? init.body : undefined;
      seen.push({ method, path: url.pathname, headers: new Headers(init?.headers), body: rawBody === undefined ? undefined : JSON.parse(rawBody) });
      const route = routes.find((r) => r.method === method && r.path === url.pathname);
      if (route === undefined) {
        return jsonResponse({ status: 404, body: { message: 'no stub' } });
      }
      const replies = Array.isArray(route.reply) ? route.reply : [route.reply];
      const callIndex = seen.filter((s) => s.method === method && s.path === url.pathname).length - 1;
      const reply = replies[Math.min(callIndex, replies.length - 1)];
      if (reply === 'network-error') {
        throw new TypeError('fetch failed');
      }
      return jsonResponse(reply);
    }),
  );
  return seen;
}

export function callWith<R>({ fn, ctx }: { fn: (ctx: never) => R; ctx: unknown }): R {
  return Reflect.apply(fn, undefined, [ctx]);
}

function jsonResponse({ status = 200, body }: Reply): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export type Reply = { status?: number; body?: unknown };

export type Route = {
  method: string;
  path: string;
  reply: Reply | 'network-error' | (Reply | 'network-error')[];
};

export type Seen = {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
};
