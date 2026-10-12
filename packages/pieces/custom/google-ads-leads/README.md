# Google Ads Lead Forms piece

Trigger **New Lead**: starts a flow the moment someone submits a Google Ads lead form
(Google Ads webhook integration). No Google account connection is needed.

- **Key check:** the `google_key` Google sends must match the trigger's *Webhook Key*
  (constant-time compare). Mismatches fail the run and nothing downstream executes.
  Activepieces answers async webhooks with `200 {}` before piece code runs, so Google
  never sees a 4xx for a bad key (upstream limitation, GIT-628); the failed run is visible
  in run history.
- **Saved before acknowledged:** the async webhook route queues the request (Redis/BullMQ,
  large payloads offloaded to storage) and only then replies `200 {}`, which is the reply
  Google expects.
- **Duplicates:** a real lead whose `lead_id` was already seen by this flow is dropped.
  This is best-effort; the hard guarantee is the idempotent CRM upsert in `our-crm`.
  Test leads are never deduplicated so *Send test data* works repeatedly.
- **Test leads:** `is_test` leads pass through (flagged) by default, or can be ignored.
- **Output:** one flat lead: every form column becomes a lower-case field
  (`FULL_NAME` → `full_name`, custom question → slug of its id/name), plus `full_name`
  built from first + last when needed, `email`, `phone_number`, campaign/ad group/form/
  creative ids as strings, `is_test`, `source: google_ads`, and `raw` (the original
  payload without `google_key`). Unknown Google fields are kept in `raw`.

## Test

```bash
npx vitest run
```

`test/fixtures/google-ads-test-lead.json` is reconstructed from Google's documented test
payload (the docs site was unreachable from the build sandbox). Replace it with a real
capture from **Send test data** once the server is live, and add a custom-question sample.

Manual test: build a flow **Google Ads Lead Forms → New Lead** then **Our CRM → Create or
Update Lead** (map `lead_id` to Lead ID, source *Google Ads*). Paste the URL and key shown
in the trigger into the Google Ads lead form, click **Send test data**, then **Test
trigger** in the builder. Google only posts to HTTPS, so this needs the staging server.
Before go-live, prove CRM delivery in run history — a green 200 in Google Ads only proves
the lead was received.
