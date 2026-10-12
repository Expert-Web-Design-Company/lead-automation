# Our CRM piece

Action **Create or Update Lead**: sends a lead from any trigger (Google Ads, Facebook,
website form, …) to our CRM with no duplicates.

- **Duplicate-safe:** every request carries `Idempotency-Key: <account id>:<source>:<lead id>`
  (also sent as `unique_key`). A repeated or retried lead updates the same CRM record.
- **Retries:** 429, 5xx, network errors and timeouts are retried up to 4 attempts with
  exponential backoff + jitter (max 10 s). 400/401/403/404/409/422 fail at once with a
  plain-language message.
- **Field rules:** name trimmed / first+last joined, email lower-cased, phone to E.164 when
  valid (raw value kept otherwise). Extra CRM fields load from the CRM, required ones marked.
- **PII:** the lead body is redacted from HTTP error logs.

## CRM contract — ASSUMED, pending CRM team confirmation

All of it lives in `src/lib/common/crm-api.ts`:

| Call | Request | Response |
|---|---|---|
| Field list (also the connection check) | `GET /api/v1/leads/fields` | `{ fields: [{ key, label, type, required }] }` |
| Upsert | `POST /api/v1/leads/upsert` + `Idempotency-Key` header | `201` created / `200` updated, `{ id, status? }` |

## Test

```bash
cd packages/pieces/custom/our-crm
npx vitest run                     # unit tests (CRM stubbed)
FAIL_FIRST=1 npm run mock-crm      # local mock CRM on :4010, API key dev-key
```

Manual test in the app:
1. Start the mock CRM (above), then from the repo root: `AP_DEV_PIECES=our-crm npm start`.
2. Open http://localhost:4200, create a flow with a **Webhook** trigger and the
   **Our CRM → Create or Update Lead** action.
3. Connection: CRM URL `http://localhost:4010`, API key `dev-key`, Account ID `abic`.
   (If the engine blocks localhost, add it to `AP_SSRF_ALLOW_LIST`.)
4. Map Lead ID, name, email, phone and *Service interest*, then **Test step** twice:
   the mock logs `created lead 1000` then `updated lead 1000` — one record, no duplicate.
