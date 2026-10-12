import { createHash, timingSafeEqual } from 'node:crypto';

function parse({ body }: { body: unknown }): GoogleAdsLead {
  if (!isRecord(body) || typeof body['lead_id'] !== 'string' || body['lead_id'].trim() === '') {
    throw new Error('This request is not a Google Ads lead: it has no lead_id. Check that the webhook URL is only used in a Google Ads lead form.');
  }
  const columns = toColumns(body['user_column_data']);
  const fullName = columns['full_name'] ?? joinName({ first: columns['first_name'], last: columns['last_name'] });
  const raw = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'google_key'));
  return {
    ...columns,
    lead_id: body['lead_id'].trim(),
    full_name: fullName,
    email: columns['email'] ?? columns['work_email'],
    phone_number: columns['phone_number'] ?? columns['work_phone'],
    form_id: toIdString(body['form_id']),
    campaign_id: toIdString(body['campaign_id']),
    adgroup_id: toIdString(body['adgroup_id']),
    creative_id: toIdString(body['creative_id']),
    gcl_id: toIdString(body['gcl_id']),
    api_version: toIdString(body['api_version']),
    lead_submit_time: toIdString(body['lead_submit_time']),
    is_test: body['is_test'] === true,
    source: 'google_ads',
    raw,
  };
}

function isKeyValid({ received, expected }: { received: unknown; expected: string }): boolean {
  if (typeof received !== 'string' || expected.length === 0) {
    return false;
  }
  return timingSafeEqual(sha256(received), sha256(expected));
}

function dedupeStoreKey({ leadId }: { leadId: string }): string {
  return `gads_lead_${sha256(leadId).toString('hex')}`;
}

function toColumns(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {};
  }
  return value.filter(isRecord).reduce<Record<string, string>>((fields, column) => {
    const id = typeof column['column_id'] === 'string' && column['column_id'] !== '' ? column['column_id'] : column['column_name'];
    const key = typeof id === 'string' ? toFieldKey(id) : '';
    const answer = typeof column['string_value'] === 'string' ? column['string_value'].trim() : '';
    return key === '' || answer === '' ? fields : { ...fields, [key]: answer };
  }, {});
}

function toFieldKey(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function joinName({ first, last }: { first?: string; last?: string }): string | undefined {
  const joined = [first, last].filter((part) => part !== undefined && part !== '').join(' ');
  return joined === '' ? undefined : joined;
}

function toIdString(value: unknown): string | undefined {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const googleLead = { parse, isKeyValid, dedupeStoreKey };

export type GoogleAdsLead = Record<string, unknown> & {
  lead_id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  form_id?: string;
  campaign_id?: string;
  adgroup_id?: string;
  creative_id?: string;
  gcl_id?: string;
  api_version?: string;
  lead_submit_time?: string;
  is_test: boolean;
  source: 'google_ads';
  raw: Record<string, unknown>;
};
