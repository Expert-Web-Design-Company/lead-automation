import { AppConnectionType } from '@activepieces/pieces-framework';
import { expect, test } from 'vitest';
import { createOrUpdateLeadAction } from '../src/lib/actions/create-or-update-lead';
import { callWith } from './helpers';

const auth = { type: AppConnectionType.CUSTOM_AUTH, props: { base_url: 'http://localhost:4010', api_key: 'dev-key', tenant_id: 'abic' } };
const props = { source: 'google_ads', external_lead_id: 'G-1', full_name: 'Jane Doe', email: 'J@X.COM', phone: '4155552671', phone_country: 'US', custom_fields: { service_interest: 'Implants' } };
const run = (p: Record<string, unknown>) => callWith({ fn: createOrUpdateLeadAction.run, ctx: { auth, propsValue: p } });

test('end to end against mock CRM', async () => {
  const first = await run(props);
  const again = await run({ ...props, email: 'new@x.com' });
  const list = await (await fetch('http://localhost:4010/api/v1/leads', { headers: { authorization: 'Bearer dev-key' } })).json();
  console.log(JSON.stringify({ first, again, count: list.count }, null, 1));
  expect(first).toMatchObject({ status: 'created', attempts: 2 });
  expect(again).toMatchObject({ status: 'updated', crm_lead_id: first.crm_lead_id });
  expect(list.count).toBe(1);
  await expect(run({ ...props, external_lead_id: 'G-2', custom_fields: {} })).rejects.toThrow('service_interest are required');
}, 30000);
