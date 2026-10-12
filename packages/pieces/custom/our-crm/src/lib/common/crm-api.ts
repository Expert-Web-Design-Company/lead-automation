import { AuthenticationType, httpClient, HttpMethod } from '@activepieces/pieces-common';
import { PermanentDeliveryError } from './delivery';

const REQUEST_TIMEOUT_MS = 15_000;

async function listFields({ connection }: { connection: CrmConnection }): Promise<CrmField[]> {
  const response = await httpClient.sendRequest<{ fields: CrmField[] }>({
    method: HttpMethod.GET,
    url: `${normalizeBaseUrl(connection.baseUrl)}/api/v1/leads/fields`,
    authentication: { type: AuthenticationType.BEARER_TOKEN, token: connection.apiKey },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return response.body.fields ?? [];
}

async function upsertLead({
  connection,
  lead,
  idempotencyKey,
}: {
  connection: CrmConnection;
  lead: CrmLeadPayload;
  idempotencyKey: string;
}): Promise<CrmUpsertResult> {
  const response = await httpClient.sendRequest<{ id?: string | number; status?: string }>({
    method: HttpMethod.POST,
    url: `${normalizeBaseUrl(connection.baseUrl)}/api/v1/leads/upsert`,
    authentication: { type: AuthenticationType.BEARER_TOKEN, token: connection.apiKey },
    headers: { 'Idempotency-Key': idempotencyKey },
    body: lead,
    timeout: REQUEST_TIMEOUT_MS,
    redactBodyInErrors: true,
  });
  const id = response.body?.id;
  if (id === undefined || id === null || id === '') {
    throw new PermanentDeliveryError('The CRM accepted the lead but did not return a lead id. Check the CRM upsert endpoint.');
  }
  const status = response.body.status === 'created' || response.body.status === 'updated'
    ? response.body.status
    : response.status === 201 ? 'created' : 'updated';
  return { crmLeadId: String(id), status };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export const crmApi = { listFields, upsertLead };

export type CrmConnection = {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
};

export type CrmField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'boolean' | 'date' | string;
};

export type CrmLeadPayload = {
  external_lead_id: string;
  unique_key: string;
  source: string;
  full_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  campaign_id?: string;
  form_id?: string;
  ad_id?: string;
  lead_channel?: string;
  custom_fields?: Record<string, unknown>;
  source_payload?: Record<string, unknown>;
};

export type CrmUpsertResult = {
  crmLeadId: string;
  status: 'created' | 'updated';
};
