import { afterEach, describe, expect, test, vi } from 'vitest';
import { ourCrm } from '../src/index';
import { createOrUpdateLeadAction } from '../src/lib/actions/create-or-update-lead';
import { ourCrmAuth } from '../src/lib/auth';
import { leadNormalizer } from '../src/lib/common/lead-normalizer';
import crmFields from './fixtures/crm-fields.json';
import { callWith, crmAuth, stubCrm } from './helpers';

const UPSERT = '/api/v1/leads/upsert';
const FIELDS = '/api/v1/leads/fields';

const GOOGLE_LEAD_PROPS = {
  source: 'google_ads',
  external_lead_id: ' TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
  first_name: '  Jane ',
  last_name: 'Doe  ',
  email: '  Jane.Doe@Example.COM ',
  phone: '(415) 555-2671',
  phone_country: 'US',
  campaign_id: '123456',
  form_id: '987',
  lead_channel: 'Paid Search',
  custom_fields: { service_interest: 'Implants' },
};

function runAction(props: Record<string, unknown>) {
  return callWith({ fn: createOrUpdateLeadAction.run, ctx: { auth: crmAuth(), propsValue: props } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('create or update lead', () => {
  test('sends a normalised lead with a stable idempotency key', async () => {
    const seen = stubCrm([{ method: 'POST', path: UPSERT, reply: { status: 201, body: { id: 501 } } }]);

    const output = await runAction(GOOGLE_LEAD_PROPS);

    expect(output).toEqual({
      crm_lead_id: '501',
      status: 'created',
      source: 'google_ads',
      external_lead_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      idempotency_key: 'abic:google_ads:TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      attempts: 1,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].headers.get('authorization')).toBe('Bearer KEY-123');
    expect(seen[0].headers.get('idempotency-key')).toBe('abic:google_ads:TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(seen[0].body).toMatchObject({
      external_lead_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      unique_key: 'abic:google_ads:TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      full_name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+14155552671',
      campaign_id: '123456',
      form_id: '987',
      lead_channel: 'Paid Search',
      custom_fields: { service_interest: 'Implants' },
    });
  });

  test('a repeated lead reuses the same key, so the CRM updates instead of duplicating', async () => {
    const seen = stubCrm([{
      method: 'POST',
      path: UPSERT,
      reply: [{ status: 201, body: { id: 501 } }, { status: 200, body: { id: 501, status: 'updated' } }],
    }]);

    const first = await runAction(GOOGLE_LEAD_PROPS);
    const second = await runAction(GOOGLE_LEAD_PROPS);

    expect(seen.map((s) => s.headers.get('idempotency-key'))).toEqual([
      'abic:google_ads:TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abic:google_ads:TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ]);
    expect(first).toMatchObject({ crm_lead_id: '501', status: 'created' });
    expect(second).toMatchObject({ crm_lead_id: '501', status: 'updated' });
  });

  test('retries server errors, rate limits and network failures, then succeeds', async () => {
    const seen = stubCrm([{
      method: 'POST',
      path: UPSERT,
      reply: [{ status: 503 }, { status: 429 }, 'network-error', { status: 201, body: { id: 'L-9' } }],
    }]);

    const output = await runAction(GOOGLE_LEAD_PROPS);

    expect(output).toMatchObject({ crm_lead_id: 'L-9', attempts: 4 });
    expect(new Set(seen.map((s) => s.headers.get('idempotency-key'))).size).toBe(1);
  });

  test('gives up after the retry cap with a plain-language error', async () => {
    const seen = stubCrm([{ method: 'POST', path: UPSERT, reply: { status: 502 } }]);

    await expect(runAction(GOOGLE_LEAD_PROPS)).rejects.toThrow(
      'The CRM had a server error (HTTP 502). Gave up after 4 attempts; the lead was not delivered.',
    );
    expect(seen).toHaveLength(4);
  });

  test.each([400, 409, 422])('does not retry a permanent %i rejection and surfaces the CRM message', async (status) => {
    const seen = stubCrm([{ method: 'POST', path: UPSERT, reply: { status, body: { message: 'service_interest is required' } } }]);

    await expect(runAction(GOOGLE_LEAD_PROPS)).rejects.toThrow(
      `The CRM refused this lead (HTTP ${status}): service_interest is required. Fix the field mapping, then resend the lead.`,
    );
    expect(seen).toHaveLength(1);
  });

  test('a rejected API key is permanent and tells the user how to fix it', async () => {
    const seen = stubCrm([{ method: 'POST', path: UPSERT, reply: { status: 401 } }]);

    await expect(runAction(GOOGLE_LEAD_PROPS)).rejects.toThrow('The CRM rejected the API key. Open the CRM connection and update the key.');
    expect(seen).toHaveLength(1);
  });

  test('keeps lead PII out of error logs', async () => {
    stubCrm([{ method: 'POST', path: UPSERT, reply: { status: 422, body: { message: 'bad' } } }]);

    await expect(runAction(GOOGLE_LEAD_PROPS)).rejects.toThrow();
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain('jane.doe@example.com');
    expect(logged).not.toContain('+14155552671');
  });

  test('refuses an empty lead id instead of sending an unkeyed lead', async () => {
    const seen = stubCrm([]);

    await expect(runAction({ ...GOOGLE_LEAD_PROPS, external_lead_id: '   ' })).rejects.toThrow('Lead ID is empty');
    expect(seen).toHaveLength(0);
  });

  test('a success response without a lead id is reported as a failure', async () => {
    stubCrm([{ method: 'POST', path: UPSERT, reply: { status: 200, body: {} } }]);

    await expect(runAction(GOOGLE_LEAD_PROPS)).rejects.toThrow('did not return a lead id');
  });
});

describe('CRM field list', () => {
  test('loads extra CRM fields, marks required ones and skips fields mapped above', async () => {
    stubCrm([{ method: 'GET', path: FIELDS, reply: { body: crmFields } }]);

    const props = await callWith({
      fn: createOrUpdateLeadAction.props.custom_fields.props,
      ctx: { auth: crmAuth() },
    });

    expect(Object.keys(props)).toEqual(['service_interest', 'budget', 'consent_marketing', 'preferred_call_time']);
    expect(props['service_interest']).toMatchObject({ displayName: 'Service interest', required: true, type: 'SHORT_TEXT' });
    expect(props['budget']).toMatchObject({ required: false, type: 'NUMBER' });
    expect(props['consent_marketing']).toMatchObject({ type: 'CHECKBOX' });
    expect(props['preferred_call_time']).toMatchObject({ type: 'DATE_TIME' });
  });
});

describe('connection check', () => {
  const validate = (auth: Record<string, string>) => callWith({ fn: ourCrmAuth.validate!, ctx: { auth } });
  const flatAuth = crmAuth().props;

  test('accepts a working URL and key', async () => {
    stubCrm([{ method: 'GET', path: FIELDS, reply: { body: crmFields } }]);
    await expect(validate(flatAuth)).resolves.toEqual({ valid: true });
  });

  test('explains a bad key in plain language', async () => {
    stubCrm([{ method: 'GET', path: FIELDS, reply: { status: 403 } }]);
    await expect(validate(flatAuth)).resolves.toEqual({
      valid: false,
      error: 'The CRM rejected the API key. Open the CRM connection and update the key.',
    });
  });
});

describe('field normalisation', () => {
  test.each([
    [{ fullName: '  Jane   Q  Doe ' }, 'Jane Q Doe'],
    [{ firstName: 'Jane', lastName: 'Doe' }, 'Jane Doe'],
    [{ firstName: 'Jane' }, 'Jane'],
    [{ fullName: '   ', lastName: 'Doe' }, 'Doe'],
    [{}, undefined],
  ])('full name %j -> %s', (input, expected) => {
    expect(leadNormalizer.fullName(input)).toBe(expected);
  });

  test.each([
    ['(415) 555-2671', 'US', '+14155552671'],
    ['+44 20 7946 0958', 'US', '+442079460958'],
    ['0044 20 7946 0958', undefined, '+442079460958'],
    ['020 7946 0958', 'gb', '+442079460958'],
    ['12345', 'US', '12345'],
    ['call me', 'US', 'call me'],
    ['   ', 'US', undefined],
  ])('phone %s (%s) -> %s', (value, defaultCountry, expected) => {
    expect(leadNormalizer.phone({ value, defaultCountry })).toBe(expected);
  });

  test('email is trimmed and lower-cased', () => {
    expect(leadNormalizer.email('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
  });
});

describe('piece definition', () => {
  test('action carries the required AI metadata and is marked idempotent', () => {
    const action = ourCrm.actions()['create_or_update_lead'];
    expect(action.classification).toBe('WRITE');
    expect(action.audience).toBe('both');
    expect(action.aiMetadata?.idempotent).toBe(true);
  });
});
