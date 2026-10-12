import { createTrigger, MarkdownVariant, PieceAuth, Property, StoreScope, TriggerStrategy } from '@activepieces/pieces-framework';
import { googleLead } from '../common/google-lead';

const SETUP_INSTRUCTIONS = `**Connect your Google Ads lead form**

1. In Google Ads, open your lead form asset and go to **Lead delivery options → Webhook integration**.
2. Paste this URL into **Webhook URL**:
\`\`\`text
{{webhookUrl}}
\`\`\`
3. Paste your **Webhook Key** (below) into **Key**.
4. Click **Send test data**, then click **Test trigger** here to see the lead.`;

const SAMPLE_LEAD = {
  lead_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  full_name: 'Jane Doe',
  email: 'jane.doe@example.com',
  phone_number: '+16505550123',
  postal_code: '94043',
  company_name: 'Example Dental',
  which_service_are_you_interested_in: 'Implants',
  form_id: '40000000000',
  campaign_id: '20000000000',
  adgroup_id: '20000000000',
  creative_id: '30000000000',
  gcl_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  api_version: '1.0',
  is_test: true,
  source: 'google_ads',
  raw: {},
};

export const newLeadTrigger = createTrigger({
  auth: PieceAuth.None(),
  name: 'new_lead',
  displayName: 'New Lead',
  description: 'Starts instantly when someone submits your Google Ads lead form.',
  classification: 'READ',
  aiMetadata: {
    description:
      'Fires once per Google Ads lead form submission delivered by the Google Ads webhook. Each run carries one lead with its answers as flat fields (full_name, email, phone_number, …) plus campaign, ad group and form ids. Requests with the wrong Google key are rejected and repeat deliveries of the same lead_id are ignored.',
  },
  props: {
    instructions: Property.MarkDown({
      value: SETUP_INSTRUCTIONS,
      variant: MarkdownVariant.BORDERLESS,
    }),
    google_key: Property.ShortText({
      displayName: 'Webhook Key',
      description: 'Make up a long, random password (at least 16 characters) and paste the same value into the "Key" box of your Google Ads lead form.',
      required: true,
    }),
    test_leads: Property.StaticDropdown({
      displayName: 'Test Leads',
      description: 'Google marks leads sent with "Send test data" as test leads.',
      required: true,
      defaultValue: 'pass',
      options: {
        disabled: false,
        options: [
          { label: 'Let test leads through (marked as test)', value: 'pass' },
          { label: 'Ignore test leads', value: 'skip' },
        ],
      },
    }),
  },
  type: TriggerStrategy.WEBHOOK,
  sampleData: SAMPLE_LEAD,
  async onEnable() {
    return;
  },
  async onDisable() {
    return;
  },
  async run(context) {
    const body = context.payload.body;
    const receivedKey = typeof body === 'object' && body !== null && 'google_key' in body ? body.google_key : undefined;
    if (!googleLead.isKeyValid({ received: receivedKey, expected: context.propsValue.google_key })) {
      throw new Error('Rejected a request with the wrong Google Ads key. Make sure the Key in your Google Ads lead form matches the Webhook Key in this trigger.');
    }
    const lead = googleLead.parse({ body });
    if (lead.is_test) {
      return context.propsValue.test_leads === 'skip' ? [] : [lead];
    }
    const storeKey = googleLead.dedupeStoreKey({ leadId: lead.lead_id });
    const alreadySeen = await context.store.get<boolean>(storeKey, StoreScope.FLOW);
    if (alreadySeen) {
      return [];
    }
    await context.store.put(storeKey, true, StoreScope.FLOW);
    return [lead];
  },
});
