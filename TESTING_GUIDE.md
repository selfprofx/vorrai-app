# Vorrai end-to-end testing guide

How to exercise every feature added in A.1–A.9 + the dashboard layer.
Covers seven flows: pre-test data setup, captcha setup, landing form
(current state + what to change), doctor on the dashboard, secretary on
the dashboard, patient via web link, doctor via WhatsApp, patient via
WhatsApp, and how to run the clinical QA scenarios.

Every flow starts from the same prerequisite: **at least one clinical
tenant must exist in DynamoDB with a populated `TenantDetail` + at
least one `ClinicLocation` + at least one `TenantStaff` doctor**.
Without that data, every chat surface routes to "tenant not found"
and the dashboard is empty.

---

## 0. Pre-test data setup

### 0.1 Choose your test tenant id

Pick a deterministic `tenant_id` so you can re-derive it later. Two
common choices:

| Use case                                  | tenant_id        |
|-------------------------------------------|------------------|
| Local dev / staging clinic                | `test.clinic`    |
| Production smoke against the demo number  | `acme.clinic`    |

The vorrai-presale synthetic tenant is reserved (`vorrai-presale`) —
never use that for a real clinic.

### 0.2 Run the table-creation script (idempotent)

```bash
cd vendia-scripts
./dynamo_create_tables.sh --region us-east-1
```

This creates all 57 tables. Idempotent — safe to re-run after schema
changes.

### 0.3 Seed `TenantDetail` for the test clinic

```bash
cd vendia-models
.venv/bin/python -m vendia_models.dtos.tenant.config.sync push --tenant vorrai
```

This pushes `config/full/vorrai.yaml` into DynamoDB. The `tenant_id` it
writes is `vorrai.co` (defined inside the YAML). For a NEW test tenant
that doesn't have its own YAML, you can shortcut:

```python
from vendia_models.dynamo.dao.tenant_detail_dao import TenantDetailDAO
d = TenantDetailDAO(tenant_id='test.clinic',
                    vertical='clinical',
                    clinical_mode='receptionist',
                    name='Test Clinic',
                    timezone='America/Sao_Paulo')
d.save()
```

### 0.4 Create at least one `ClinicLocation`

Either via the dashboard once you're logged in (recommended) or via the
backend's `POST /dashboard/clinic/locations` (Cognito-token in the
Authorization header). Most flows below assume the test tenant has at
least one location + at least one doctor.

---

## 1. Captcha setup (Cloudflare Turnstile for vorrai.co)

The captcha runs on every `/submit` and `/blog/subscribe` call. The
secret per origin lives in DynamoDB table `TurnstileConfig`
(PK = `origin_host`). Today two rows are pre-seeded by
`dynamo_create_tables.sh`:

| origin_host       | secret               |
|-------------------|----------------------|
| jhcontext.com     | `0x4AAA...4V3Y`      |
| vendia.vip        | `0x4AAA...KSPU`      |

`vorrai.co` has no row yet, so any form submission from vorrai-landing
fails captcha validation with "Unknown origin". To fix:

### 1.1 Cloudflare side — create a Turnstile site

1. Sign in to **Cloudflare → Account home → Turnstile**.
2. **Add site**. Set:
   - Site name: `Vorrai`
   - Hostnames: `vorrai.co`, `staging.vorrai.co` (if using), `localhost`
   - Widget mode: **Managed** (Cloudflare picks visible vs invisible)
3. Save. Copy the **Site Key** (public) and **Secret Key** (private).

### 1.2 Backend side — seed the secret in DynamoDB

Add a line to `vendia-scripts/dynamo_create_tables.sh` next to the
existing put_turnstile calls (around line ~1395):

```bash
put_turnstile "vorrai.co" "0x4AAA...your-secret-here"
```

Then run the script again — or `put-item` directly:

```bash
aws dynamodb put-item --table-name TurnstileConfig --region us-east-1 \
  --item '{"origin_host":{"S":"vorrai.co"},"secret":{"S":"0x4AAA...your-secret"}}'
```

### 1.3 Frontend side — inject the site key into vorrai-landing

The site key is public so it ships in the bundle. Two options:

- **Env var (recommended)**: add `VITE_TURNSTILE_SITE_KEY` to the Vercel
  project's environment variables. Then load it in the form via
  `import.meta.env.VITE_TURNSTILE_SITE_KEY`.
- **`window` global**: in `index.html` add
  `<script>window.__TURNSTILE_SITE_KEY__ = '0x4AAA...'</script>`.

### 1.4 Mount the widget in BookingForm.tsx

The current BookingForm has no Turnstile widget. Add the script tag in
`index.html`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

…and a div inside the form:

```html
<div class="cf-turnstile" data-sitekey="${VITE_TURNSTILE_SITE_KEY}"
     data-callback="onTurnstileSuccess"></div>
```

When the user solves the challenge, Cloudflare puts the token in the
form's hidden `cf-turnstile-response` field. Read it on submit and pass
it as `captcha_token` in the POST body.

---

## 2. The landing-page form — current state + what to change

### 2.1 Current state

Look at `vorrai-landing/src/components/BookingForm.tsx`:

```ts
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  // In a real app, this would hit an API
  setSubmitted(true);
};
```

The form is a **UI mockup**: it shows the success card on submit but
does NOT POST anywhere. To match the jhcontext.com flow (capture email
→ send a chat link), three things need to happen:

1. POST to `https://api.vorrai.co/submit` with the FormDTO shape.
2. The patient receives a verification email; clicking it hits
   `/verify`, which mints a `UserChatTokenDAO` and redirects to
   `/c/<slug>?token=<token>` (the patient web flow at A.3).
3. For DOCTOR signups (the actual intent of vorrai-landing's form), the
   right route is a separate doctor-signup path that goes:
   form-fill → email magic link → onboarding wizard. Today the wizard
   is reached via `/onboarding?token=<onboarding_token>` (A.2) — the
   token is minted at Stripe-checkout-success time by
   `offer_api.py:webhook`.

### 2.2 What jhcontext.com does today

The jhcontext.com flow is **patient-style** (lead → SPIN chat):

```
landing form fills → POST /submit → verification email →
  /verify mints UserChatTokenDAO →
  redirect to https://jhcontext.com/chat?token=<token>
```

This is great for SPIN sales chats (the user explores Vorrai by chatting
with the agent) but is NOT the right shape for clinical onboarding.
A doctor signing up needs to (a) qualify, (b) pay, (c) configure their
clinic — not just chat.

### 2.3 What vorrai-landing should do

The right flow for a doctor signup:

```
landing form fills (clinic_name + email + specialty + volume)
  → POST /submit with tenant_id=vorrai-presale
  → verification email
  → /verify mints a UserChatTokenDAO bound to vorrai-presale
  → redirect to https://vorrai.co/c/vorrai-presale?token=<token>
  → patient web chat — but this time the agent is FlowChatPreSaleClinical
  → at SPIN_CLOSE the closer agent emits the offer link
  → Stripe checkout
  → on success, offer_api.webhook mints TenantOnboardingDAO + the
    onboarding token
  → emails the doctor: "your Vorrai setup link is ready"
  → doctor opens https://app.vorrai.co/onboarding?token=<onboarding_token>
  → walks stages 1–10
  → POST /onboarding/complete creates all the rows + the patient share-link
```

To wire the landing form to step 1, replace `handleSubmit` with a real
`fetch` to `/submit`. Bare minimum payload:

```ts
const body = {
  tenant_id: 'vorrai-presale',
  full_name: formData.clinic_name,
  email: emailInput,
  captcha_token: turnstileToken,
  consent_call_recording: true,
  extra_fields: {
    specialty: formData.specialty,
    monthly_patient_volume: formData.monthly_patient_volume,
    current_booking_software: formData.current_booking_software,
    linkedin_handle: formData.linkedin_handle,
  },
};
await fetch(`${API_BASE}/submit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

The `vorrai-presale` tenant needs a `TenantFormSchema` row defining the
extra_fields. Seed it with `vendia-scripts/seed_form_schemas.py` (add a
new entry mirroring the jhcontext.com one but with the clinical fields).

### 2.4 Until that's wired

While the form is still a UI mockup, you can simulate the doctor-signup
flow by calling `/submit` directly via curl (skip the UI):

```bash
curl -X POST https://api.vorrai.co/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "vorrai-presale",
    "full_name": "Test Doctor",
    "email": "doctor@example.com",
    "captcha_token": "BYPASS",
    "consent_call_recording": true,
    "extra_fields": {"specialty": "Dermatology"}
  }'
```

…then check the email inbox for the verification link.

---

## 3. Test flow A — Doctor on the dashboard

**Goal**: log in as a doctor at `app.vorrai.co` (or `localhost:4200`),
see the full sidebar, exercise locations / staff / clinic-profile /
share-links.

### 3.1 Create a doctor Cognito user

```bash
cd vendia-scripts
python setup_cognito.py --create-tenant-role-groups test.clinic
```

(This creates `tenant:test.clinic:doctor` + `tenant:test.clinic:secretary`
groups.) Then create a Cognito user manually:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username doctor@test.clinic \
  --user-attributes Name=email,Value=doctor@test.clinic \
                    Name=email_verified,Value=true \
                    Name=custom:tenant_id,Value=test.clinic \
  --temporary-password 'TempPass123!' \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username doctor@test.clinic \
  --group-name tenant:test.clinic:doctor
```

### 3.2 Log in + exercise the dashboard

| Step | Expected |
|------|----------|
| Open `app.vorrai.co/auth/login`, enter `doctor@test.clinic` + `TempPass123!` | Forced password change → set permanent password |
| Land on `/dashboard` | Sidebar shows Home + Clinic ops + Content + Management groups (all visible — doctor tier) |
| Sidebar contains: Dashboard, Appointments, Patients, Chats, **Locations, Staff, Share-links, Clinic profile**, plus Content + Management groups | The four bold items are the new dashboard pages from this iteration |
| Open `/locations` → "Add location" → fill name + address + timezone + Save | New row appears in DynamoDB `ClinicLocation` table. First location auto-defaults `is_default=true` |
| Open `/staff` → "Add doctor" with email `dr.silva@test.clinic` | Cognito user `dr.silva@test.clinic` is created + added to `tenant:test.clinic:doctor`. Response shows `cognito_provisioned: true` |
| Try to delete the only location | 400 with "cannot delete the only location" — defensive last-location protection |
| Open `/clinic-profile` → fill display_name + slug + primary_specialty + bio + toggle `directory_opt_in` → "Publish to directory" | Profile flipped to `published=true`, public URL `vorrai.co/clinics/<slug>` appears |
| Open `/share-links` | Three sections (clinic-wide, per-doctor, per-location). Each has a `share_text` + `share_url` + copy buttons |

### 3.3 What doctor's writes look like in the audit log

Every write through `_require_doctor` stamps `last_modified_by_hash` on
the DAO row (a SHA-256 of `<sourceIp>:<tenant_id>`). Inspect via:

```bash
aws dynamodb get-item --table-name ClinicLocation --region us-east-1 \
  --key '{"tenant_location_id":{"S":"test.clinic#<loc_id>"},"created_at":{"S":"..."}}'
```

---

## 4. Test flow B — Secretary on the dashboard

**Goal**: log in as a secretary at `app.vorrai.co`, see the **trimmed**
sidebar, confirm write actions are hidden, confirm reads still work.

### 4.1 Create a secretary Cognito user

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username secretary@test.clinic \
  --user-attributes Name=email,Value=secretary@test.clinic \
                    Name=email_verified,Value=true \
                    Name=custom:tenant_id,Value=test.clinic \
  --temporary-password 'TempPass123!' \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --username secretary@test.clinic \
  --group-name tenant:test.clinic:secretary
```

### 4.2 Log in + verify the gated UX

| Step | Expected |
|------|----------|
| Log in as secretary | Forced password change → land on `/dashboard` |
| Inspect sidebar | Sees **Home + Clinic ops only**. Content + Management groups are HIDDEN. `Clinic profile` is HIDDEN. `Locations` + `Staff` + `Share-links` are visible |
| Open `/locations` | List loads. "Add location" button is HIDDEN. Per-row edit/delete buttons are HIDDEN |
| Open `/staff` | Both staff sections load. "Add doctor" + "Add secretary" + edit/delete buttons are all HIDDEN |
| Open `/clinic-profile` directly via URL | Page loads (read endpoint is permissive). But hitting "Save" → 403 from the server (form value would not persist). UI doesn't currently hide the buttons — see open issue below |
| Open `/share-links` | All three sections + copy buttons work. No write actions on this page. Both roles fully use it |
| Open `/users/<id>/anamnesis` (a patient's anamnesis) | Page loads. Doctor-notes textarea is visible — secretary can read the existing notes but the Save button will 403 |
| Try to navigate to `/contents` (manually edit the URL) | Component loads but write actions 403 |

**Known gap**: the clinic-profile editor doesn't yet hide its
"Save changes" / "Publish" buttons for secretaries. Backend `_require_doctor`
rejects the writes — the dashboard surfaces a Nebular toast on failure
— but the cleaner UX is to hide the buttons. Tracked as a small
follow-up (Locations + Staff + Anamnesis already hide their write
buttons; only Clinic-profile + Settings still don't).

---

## 5. Test flow C — Patient via web link

**Goal**: open the patient share-link → consent → anamnesis →
appointment booked.

### 5.1 Mint a patient share-link

Two ways:

**A. Real flow** — completing onboarding emits the link. From the
dashboard after `POST /onboarding/complete`, the response carries
`patient_link_url`. Copy it.

**B. Direct DynamoDB mint** — paste this in `vendia-api`'s venv:

```python
import secrets, time
from vendia_models.dynamo.dao.user_chat_token_dao import UserChatTokenDAO

token = secrets.token_urlsafe(32)
r = UserChatTokenDAO()
r.token = token
r.tenant_id = 'test.clinic'
r.user_id = f'public-{secrets.token_hex(6)}'
r.request_id = f'manual-{secrets.token_urlsafe(16)}'
r.expires_at = int(time.time()) + 60*60*24*365
r.max_uses = 10_000_000
r.metadata = {
    'kind': 'clinic_patient_link',
    'clinic_slug': 'test-clinic',
}
r.save()
print(f'https://vorrai.co/c/test-clinic?token={token}')
```

### 5.2 Walk the flow

| Step | Expected |
|------|----------|
| Open the link in an incognito window | `/clinic/test-clinic/preflight?token=...` fires → fetches clinic + locations + doctors. If multi-doctor/multi-location AND token didn't pre-resolve, picker shows first |
| Pick a doctor + location (or skip if single) | Picker submits, chat opens. WebSocket connects with `?token=...`. First message Vorrai sees is "I'd like to book at <clinic> with <doctor> at the <location> location." |
| Send a free-text message ("Tive uma reação alérgica leve") | `FlowChatReceptionist` runs (default for clinical-mode = receptionist) — health-data tripwire fires + Vorrai deflects: "I'm an administrative AI, I can help with bookings but I can't evaluate symptoms" |
| Or: type "queria marcar uma consulta" | Booking flow starts. Doctor/location confirmation if multi. Available slots queried from Google/MS calendar (or local CalendarEvent if no provider connected) |
| Pick a slot | `CalendarEvent` row created. Patient sees confirmation. Dashboard's `/bookings` shows the new appointment + `pretriage_status: not_started` |
| Refresh `/bookings` in the doctor dashboard | New row appears via the `booking_created` WS event. Pre-Triage badge shows status |

### 5.3 Intake-mode (Art-11 health-data) walk

If you flip the tenant to `clinical_mode=intake`:

```python
from vendia_models.dynamo.dao.tenant_detail_dao import TenantDetailDAO
d = TenantDetailDAO.get('test.clinic')
d.clinical_mode = 'intake'
d.save()
```

…then the same patient message routes to `FlowChatPreTriage` instead.
The flow requires the three consent flags (`consent_general_processing`,
`consent_ai_processing`, `consent_cross_border_transfer`) all True
before any LLM call. The web flow surfaces a consent panel; WhatsApp
intake is **deliberately blocked** (no consent UI yet — see the
WhatsApp adapter's defensive fallback to receptionist mode).

---

## 6. Test flow D — Doctor via WhatsApp

**Goal**: a doctor messages Vorrai's general WhatsApp number from their
registered personal phone → `FlowRouter` matches the phone in
`TenantStaff.PhoneIndex` → `ClinicalDoctorPracticeCrew` answers.

### 6.1 Register the doctor's phone

Via the dashboard `/staff` page (added in this iteration) — when
creating the doctor, set `phone: +5511998765432`. The repo normalises
to E.164 and writes to `TenantStaffDAO.phone_normalized_e164`, indexed
on `PhoneIndex`.

### 6.2 Send a synthetic webhook (no real WhatsApp number needed)

```bash
# Compute HMAC-SHA256 of the raw body against META_APP_SECRET
SECRET='your-meta-app-secret'
BODY='{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"VORRAI_GENERAL_NUMBER_ID"},"contacts":[{"wa_id":"5511998765432","profile":{"name":"Dr Silva"}}],"messages":[{"id":"wamid.test","from":"5511998765432","type":"text","text":{"body":"who is coming today?"}}]}}]}]}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST https://api.vorrai.co/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIG" \
  -d "$BODY"
```

### 6.3 What happens

1. Webhook verifies the signature → 200.
2. `whatsapp_webhook._handle_single_message` writes a row to
   `WhatsAppMessage` and SNS-publishes `ACTION_WHATSAPP_INBOUND`.
3. Worker handler `process_whatsapp_inbound` runs `FlowRouter`.
   - Phone match → `(tenant_id=test.clinic, role=doctor, staff_id=...)`.
   - Decision: `ClinicalDoctorPracticeCrew`.
4. Adapter builds `chat_data` + invokes the crew → tool calls
   `get_today_schedule(tenant_id=test.clinic)`.
5. Reply sent back via `whatsapp_send_tool.send_text()` → outbound
   row written to `WhatsAppMessage`.

Check the audit log:

```bash
aws dynamodb query --table-name WhatsAppMessage --region us-east-1 \
  --index-name TenantWhatsAppIndex \
  --key-condition-expression "tenant_id = :t" \
  --expression-attribute-values '{":t":{"S":"test.clinic"}}'
```

---

## 7. Test flow E — Patient via WhatsApp

Three sub-cases depending on what the patient sends:

### 7.1 wa.me deep-link payload

A patient clicks the wa.me link the clinic shared. WhatsApp opens with
prefilled text:

```
Hi! I'd like to book at Test Clinic.

Vorrai:book:clinic=test-clinic&doctor=staff-1&location=loc-1
```

`FlowRouter.parse_wa_me_payload` extracts the payload → resolves
`test-clinic` slug to `test.clinic` tenant via `TenantPublicProfile.SlugIndex`
→ decision = `clinic_waba_payload` patient pretriage pre-scoped to
doctor+location. Pretriage prompt skips the doctor/location confirmation.

### 7.2 Free-text patient keyword

Patient sends "olá, queria marcar uma consulta" to Vorrai's general
WhatsApp number. Phone is unknown to FlowRouter (no
`TenantStaff.PhoneIndex` match), no wa.me payload. Classifier returns
`patient` → routes to `patient_clinic_discovery` (today: stub asks
"which clinic?"; once the discovery sub-flow ships, it resolves via
the directory).

### 7.3 Ambiguous greeting

Patient sends "oi tudo bem?". Classifier returns `ambiguous` →
`ask_routing_question`. Worker handler renders the interactive buttons
("Doctor" / "Patient"). The next message after a button click reuses
the binding via `RouterSession`.

---

## 8. Running the clinical QA scenarios

Three new scenario sets shipped in this iteration:

```bash
cd vendia-agent

# Presale-clinical (1 happy-path scenario, 5 turns)
.venv/bin/python -m src.modules.chats.qa.tests.chat_presale_clinical.run_integration \
  "wss://<api-id>.execute-api.us-east-1.amazonaws.com/api/?token=<TOKEN>" \
  --scenarios happy_path

# Onboard-clinical (1 happy-path scenario, 5 turns)
.venv/bin/python -m src.modules.chats.qa.tests.chat_onboard_clinical.run_integration \
  "wss://..." --scenarios happy_path

# Router (6 scenarios — unit-level, no WS needed)
.venv/bin/python -m src.modules.chats.qa.tests.chat_router.run_integration
```

Output is JSON + a Markdown summary; failed assertions surface with
the turn index and the failing assertion type (e.g. `MIRRORING_PRESENT`
not met). Each set covers a representative happy path; coverage
extension (corner cases, security, multi-doctor, jurisdiction) lands
in sibling files next to each `happy_path.py`.

The router scenarios don't need a live WebSocket — they exercise
`FlowRouter.route_inbound()` directly with synthetic payloads and
mocked repos. Run-time is sub-second.

---

## 9. Test credentials cheat-sheet

Live test-login credentials (emails, passwords, tenants, Cognito groups)
live in **`TEST_CREDENTIALS.local.md`** at the repo root — a git-ignored
file, so real passwords never enter version control. Ask a maintainer for a
copy if it is missing locally.

The patient (web) flow uses a per-test `UserChatToken` share-link and the
WhatsApp flows resolve the tenant by sender phone — neither needs a stored
credential (see §5–§7).

---

## 10. What does NOT work end-to-end yet

A candid list of stub-or-mockup surfaces, in priority order:

1. **vorrai-landing form** — UI mockup, doesn't POST. See §2.3 for the
   wire-up plan.
2. **vorrai-landing Turnstile widget** — not yet mounted. See §1.4.
3. **Vorrai general WABA number procurement** — Meta Business Manager
   verification + 7–10 day display-name approval. Code is ready (A.6);
   the WABA itself is an ops task.
4. **Patient-clinic-discovery sub-flow** — patients on the general WABA
   number who don't carry a wa.me payload land on a "which clinic?"
   stub. Resolution via `TenantPublicProfile.SlugIndex` is planned.
5. **WhatsApp consent template for intake mode** — defensive fallback to
   receptionist is the safety floor today.
6. **QR-code rendering** in the share-links page — the URLs and
   share-text are ready; the QR generator (qrcode.js) hasn't been wired
   yet.
7. **Image-upload preview** in clinic-profile — works, but assumes the
   `vendia-media` S3 bucket is public-read or CloudFront-fronted. If
   the bucket is private, the preview will show a broken image until a
   GET-presigned-URL path is added.
