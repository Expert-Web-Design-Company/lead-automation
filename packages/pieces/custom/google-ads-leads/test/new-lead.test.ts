import { describe, expect, test } from 'vitest';
import { googleAdsLeads } from '../src/index';
import { googleLead } from '../src/lib/common/google-lead';
import { newLeadTrigger } from '../src/lib/triggers/new-lead';
import googleTestLead from './fixtures/google-ads-test-lead.json';

const KEY = 'test-key-0123456789';
const REAL_LEAD = { ...googleTestLead, lead_id: 'Real-Lead-001', is_test: false };

function memoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: unknown) => {
      data.set(key, value);
      return value;
    },
    delete: async (key: string) => {
      data.delete(key);
    },
  };
}

function runTrigger({ body, store = memoryStore(), testLeads = 'pass', key = KEY }: { body: unknown; store?: ReturnType<typeof memoryStore>; testLeads?: string; key?: string }) {
  const context = {
    payload: { body, headers: { 'content-type': 'application/json' }, queryParams: {} },
    propsValue: { google_key: key, test_leads: testLeads },
    store,
  };
  return Reflect.apply(newLeadTrigger.run, undefined, [context]);
}

describe('Google Ads new lead trigger', () => {
  test('turns Google\'s test payload into one flat, friendly lead', async () => {
    const [lead] = await runTrigger({ body: googleTestLead });

    expect(lead).toMatchObject({
      lead_id: googleTestLead.lead_id,
      full_name: 'FirstName LastName',
      email: 'test@example.com',
      phone_number: '+16505550123',
      postal_code: '94043',
      company_name: 'CompanyName',
      which_service_are_you_interested_in: 'Implants',
      form_id: '40000000000',
      campaign_id: '20000000000',
      adgroup_id: '20000000000',
      creative_id: '30000000000',
      api_version: '1.0',
      is_test: true,
      source: 'google_ads',
    });
  });

  test('never passes the Google key on to later steps', async () => {
    const [lead] = await runTrigger({ body: googleTestLead });

    expect(JSON.stringify(lead)).not.toContain(KEY);
    expect(lead.raw).toMatchObject({ lead_id: googleTestLead.lead_id, user_column_data: googleTestLead.user_column_data });
  });

  test.each([
    ['a wrong key', { ...googleTestLead, google_key: 'guessed-key' }],
    ['no key', { ...googleTestLead, google_key: undefined }],
  ])('rejects a request with %s and runs nothing', async (_case, body) => {
    await expect(runTrigger({ body })).rejects.toThrow('Rejected a request with the wrong Google Ads key');
  });

  test('rejects anything that is not a Google Ads lead', async () => {
    await expect(runTrigger({ body: { google_key: KEY, hello: 'world' } })).rejects.toThrow('has no lead_id');
  });

  test('a lead delivered twice starts the flow only once', async () => {
    const store = memoryStore();

    const first = await runTrigger({ body: REAL_LEAD, store });
    const second = await runTrigger({ body: REAL_LEAD, store });

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });

  test('different leads are not mistaken for duplicates', async () => {
    const store = memoryStore();

    await runTrigger({ body: REAL_LEAD, store });
    const other = await runTrigger({ body: { ...REAL_LEAD, lead_id: 'Real-Lead-002' }, store });

    expect(other).toHaveLength(1);
  });

  test('test leads are never deduplicated, so "Send test data" works every time', async () => {
    const store = memoryStore();

    expect(await runTrigger({ body: googleTestLead, store })).toHaveLength(1);
    expect(await runTrigger({ body: googleTestLead, store })).toHaveLength(1);
    expect(store.data.size).toBe(0);
  });

  test('test leads can be ignored', async () => {
    expect(await runTrigger({ body: googleTestLead, testLeads: 'skip' })).toEqual([]);
    expect(await runTrigger({ body: REAL_LEAD, testLeads: 'skip' })).toHaveLength(1);
  });

  test('tolerates fields Google adds later and odd column data', async () => {
    const [lead] = await runTrigger({
      body: {
        ...REAL_LEAD,
        brand_new_google_field: { nested: true },
        user_column_data: [
          { column_id: 'FIRST_NAME', string_value: ' Jane ' },
          { column_id: 'LAST_NAME', string_value: 'Doe' },
          { column_name: 'Preferred Time?', string_value: 'Mornings' },
          { column_id: 'EMAIL', string_value: '' },
          'garbage',
        ],
      },
    });

    expect(lead).toMatchObject({ full_name: 'Jane Doe', first_name: 'Jane', preferred_time: 'Mornings' });
    expect(lead.email).toBeUndefined();
    expect(lead.raw.brand_new_google_field).toEqual({ nested: true });
  });
});

describe('Google key check', () => {
  test.each([
    ['abc', 'abc', true],
    ['abc', 'abd', false],
    ['abc', 'abcd', false],
    [undefined, 'abc', false],
    ['', '', false],
  ])('received %s vs expected %s -> %s', (received, expected, valid) => {
    expect(googleLead.isKeyValid({ received, expected })).toBe(valid);
  });
});

describe('piece definition', () => {
  test('trigger has sample data and READ classification', () => {
    const trigger = googleAdsLeads.triggers()['new_lead'];
    expect(trigger.sampleData).toBeDefined();
    expect(trigger.classification).toBe('READ');
  });
});
