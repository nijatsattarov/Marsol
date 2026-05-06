# Test Credentials

## Admin
- Email: settings@marsol.az
- Password: marsol123
- Role: admin

## Satış meneceri
- Email: satis@marsol.az
- Password: marsol123
- Role: Satış meneceri

## Mühasib
- Email: muhasib@marsol.az
- Password: marsol123
- Role: Mühasib

## Testing Rules (USER REQUEST — 2026-05-06)
**When creating demo / test companies, contacts, or sales-leads via the testing agent:**
- DO NOT populate the phone fields (`owner_phone`, `company_phone`, `representative_phone`, `phone`).
  Leave them as empty strings `""`.
- DO NOT populate `owner_birth_date`, `representative_birth_date`, or contact `birthday` with today's
  date — that would trigger automatic birthday SMS via LSIM and consume real credits.
- LSIM SMS provider is REAL (balance ~9284). Never use real-looking AZ phone numbers
  (`+994 50…`, `0XX…`) in test data — only use `00000000` / `11111111` style placeholders that
  the provider will reject with `errorCode=-102` so the log records `status=failed` without
  charging credits.
- Always prefix test entity names with `TEST_` and clean them up with try/finally in fixtures.
