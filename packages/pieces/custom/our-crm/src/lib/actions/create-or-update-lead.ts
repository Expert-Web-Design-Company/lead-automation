import { createAction, DynamicPropsValue, Property } from '@activepieces/pieces-framework';
import { ourCrmAuth } from '../auth';
import { CrmConnection, CrmField, crmApi } from '../common/crm-api';
import { delivery } from '../common/delivery';
import { leadNormalizer } from '../common/lead-normalizer';

const LEAD_SOURCES = [
  { label: 'Google Ads', value: 'google_ads' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Website Form', value: 'website' },
  { label: 'Other', value: 'other' },
];

export const createOrUpdateLeadAction = createAction({
  auth: ourCrmAuth,
  name: 'create_or_update_lead',
  displayName: 'Create or Update Lead',
  description: 'Sends a lead to the CRM. If the same lead arrives again it updates the existing record instead of creating a duplicate.',
  audience: 'both',
  classification: 'WRITE',
  aiMetadata: {
    description:
      'Create a lead in the CRM, or update it if a lead with the same source and lead id already exists. Use for every inbound lead from ads or forms. Safe to retry: the source + lead id pair is the unique key, so repeats never create a second record.',
    idempotent: true,
  },
  props: {
    source: Property.StaticDropdown({
      displayName: 'Lead Source',
      description: 'Where this lead came from.',
      required: true,
      options: {
        disabled: false,
        options: LEAD_SOURCES,
      },
    }),
    external_lead_id: Property.ShortText({
      displayName: 'Lead ID',
      description: 'The lead id from the ad platform or form (for example the Google Ads "lead_id" or Facebook "leadgen_id"). Used to prevent duplicates, so never map a changing value here.',
      required: true,
    }),
    full_name: Property.ShortText({
      displayName: 'Full Name',
      description: 'Leave empty if the form collects first and last name separately.',
      required: false,
    }),
    first_name: Property.ShortText({ displayName: 'First Name', required: false }),
    last_name: Property.ShortText({ displayName: 'Last Name', required: false }),
    email: Property.ShortText({ displayName: 'Email', required: false }),
    phone: Property.ShortText({ displayName: 'Phone', required: false }),
    phone_country: Property.ShortText({
      displayName: 'Default Phone Country',
      description: 'Two-letter country code used when a phone number has no country prefix (for example US or GB).',
      required: false,
      defaultValue: 'US',
    }),
    company: Property.ShortText({ displayName: 'Company', required: false }),
    campaign_id: Property.ShortText({ displayName: 'Campaign ID', required: false }),
    form_id: Property.ShortText({ displayName: 'Form ID', required: false }),
    ad_id: Property.ShortText({ displayName: 'Ad ID', required: false }),
    lead_channel: Property.ShortText({
      displayName: 'Lead Channel',
      description: 'A fixed label for reporting, for example "Paid Social" or "Paid Search".',
      required: false,
    }),
    custom_fields: Property.DynamicProperties({
      displayName: 'Other CRM Fields',
      description: 'Extra fields from your CRM. Required fields are marked.',
      auth: ourCrmAuth,
      refreshers: [],
      required: false,
      props: async ({ auth }): Promise<DynamicPropsValue> => {
        if (!auth) {
          return {};
        }
        const fields = await crmApi.listFields({ connection: toConnection(auth.props) });
        const properties: DynamicPropsValue = {};
        for (const field of fields.filter((f) => !STANDARD_FIELD_KEYS.has(f.key))) {
          properties[field.key] = toProperty(field);
        }
        return properties;
      },
    }),
    source_payload: Property.Json({
      displayName: 'Original Lead Data',
      description: 'Optional. Map the whole trigger output here so the CRM keeps every original field for troubleshooting.',
      required: false,
    }),
  },
  async run(context) {
    const connection = toConnection(context.auth.props);
    const props = context.propsValue;
    const externalLeadId = props.external_lead_id.trim();
    if (!externalLeadId) {
      throw new Error('Lead ID is empty. Map the lead id from the trigger so duplicates can be prevented.');
    }
    const idempotencyKey = [connection.tenantId.trim(), props.source, externalLeadId].join(':');

    const { result, attempts } = await delivery.withRetries({
      send: () => crmApi.upsertLead({
        connection,
        idempotencyKey,
        lead: {
          external_lead_id: externalLeadId,
          unique_key: idempotencyKey,
          source: props.source,
          full_name: leadNormalizer.fullName({ fullName: props.full_name, firstName: props.first_name, lastName: props.last_name }),
          email: leadNormalizer.email(props.email),
          phone: leadNormalizer.phone({ value: props.phone, defaultCountry: props.phone_country }),
          company: leadNormalizer.text(props.company),
          campaign_id: leadNormalizer.text(props.campaign_id),
          form_id: leadNormalizer.text(props.form_id),
          ad_id: leadNormalizer.text(props.ad_id),
          lead_channel: leadNormalizer.text(props.lead_channel),
          custom_fields: props.custom_fields ?? {},
          source_payload: props.source_payload,
        },
      }),
    });

    return {
      crm_lead_id: result.crmLeadId,
      status: result.status,
      source: props.source,
      external_lead_id: externalLeadId,
      idempotency_key: idempotencyKey,
      attempts,
    };
  },
});

function toConnection(props: { base_url: string; api_key: string; tenant_id: string }): CrmConnection {
  return { baseUrl: props.base_url, apiKey: props.api_key, tenantId: props.tenant_id };
}

function toProperty(field: CrmField) {
  const common = { displayName: field.label || field.key, required: field.required === true };
  switch (field.type) {
    case 'number':
      return Property.Number(common);
    case 'boolean':
      return Property.Checkbox(common);
    case 'date':
      return Property.DateTime(common);
    default:
      return Property.ShortText(common);
  }
}

const STANDARD_FIELD_KEYS = new Set([
  'external_lead_id',
  'unique_key',
  'source',
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'company',
  'campaign_id',
  'form_id',
  'ad_id',
  'lead_channel',
]);
