import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { crmApi } from './common/crm-api';
import { delivery } from './common/delivery';

export const ourCrmAuth = PieceAuth.CustomAuth({
  displayName: 'CRM Connection',
  description: `Connect the CRM that receives your leads.

1. Ask your CRM administrator for the **CRM URL** and an **API key** with permission to create leads.
2. Enter your **Account ID** exactly as it appears in the CRM. It keeps your leads separate from other accounts and prevents duplicates.`,
  required: true,
  props: {
    base_url: Property.ShortText({
      displayName: 'CRM URL',
      description: 'The address of your CRM, for example https://crm.example.com',
      required: true,
    }),
    api_key: PieceAuth.SecretText({
      displayName: 'API Key',
      description: 'Stored encrypted on the server and never shown in the browser again.',
      required: true,
    }),
    tenant_id: Property.ShortText({
      displayName: 'Account ID',
      description: 'Your account (tenant) ID in the CRM.',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    try {
      await crmApi.listFields({ connection: { baseUrl: auth.base_url, apiKey: auth.api_key, tenantId: auth.tenant_id } });
      return { valid: true };
    }
    catch (error) {
      return { valid: false, error: delivery.classifyFailure(error).message };
    }
  },
});
