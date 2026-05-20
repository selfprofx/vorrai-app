# vorrai-app — Clinical Dashboard

Vorrai's doctor / clinic-staff dashboard, served at **`app.vorrai.co`**. Forked from `vendia_app/` (parked at `parked-vendia_app/`; old domain `app.vendia.vip`). Shares the `vendia-api` backend; routing is JWT-tenant-scoped.

## Run locally

```bash
npm install
ng serve
```

App runs on `http://localhost:4200`. Defaults to LIGHT theme (Marble White surfaces — the Vorrai.love palette). The dark theme is still available via the settings toggle — it persists under `localStorage['vorrai-theme']` (legacy key `vendia-theme` is honoured for users migrating from `parked-vendia_app/`).

## Vorrai features layered on top of the fork

- **Clinical vocabulary remap** via `src/app/core/label.service.ts` + `core/label-dictionaries/{default,clinical}.ts`. Activated per tenant when `TenantSettings.vertical === 'clinical'`. Default dictionary preserves legacy SaaS labels so marketing-vertical tenants (vendia.vip, etc.) see no regression. Affected pages: users / chats / bookings / followups (page-headers wired; the rest pick up labels via service injection as they're touched).
- **WebSocket clinical-event aliases** in `app-ws.service.ts`: `onClinical('new_patient' | 'consult_chat_update' | 'appointment_created' | …)` mirrors the underlying wire events without backend changes.
- **Pre-Triage tab** in the user-chat page (`src/app/pages/users/user-chat/`) — surfaces structured patient self-report + verbatim consent snapshot once the AI has captured the booked patient's intake.
- **Pre-Triage Ready badge** in the booking detail dialog (`src/app/pages/bookings/bookings.html`) — flips when `CalendarEventDAO.pretriage_status` is `complete` (or shows `requires_human` / `in_progress`).
- **WebSocket events** added: `pretriage_complete`, `pretriage_requires_human`. Both emitted by `vendia-agent`'s `FlowChatPreTriage` flow.
- **API**: `GET /dashboard/users/{user_id}/pretriage` returns the latest triage record. `POST /dashboard/users/{user_id}/pretriage/review` flips status to `reviewed`.

## Brand palette — anchored to Vorrai.love

Per `vendia-models/vendia_models/dtos/tenant/config/full/vorrai.co.yaml`:

- Marble White `#FAF9F6` — ~85% (primary surface, lab-coat base)
- Mist Sage `#D6E2DA` — ~10% (dove-feather mantle, secondary surface)
- Imperial Green `#004B3C` — ~3% (stethoscope, primary brand mark, CTA fill)
- Deep Slate `#1F2933` — ~2% (body text, character eyes)
- Steel Silver `#BCC6CC` — neutral structure
- **Forbidden**: Radiant Gold / Sunlit Wheat / institutional blue / pure black. See yaml comments for full reasoning.

Vorrai assets in `public/assets/` (vorrai-avatar / -greeting / -left / -listening / -monogram / -symbol / -wordmark / -wordmark-reverse).

## Status

Phase D of the Vorrai clinical pivot has shipped:

- [x] Repo forked from `vendia_app`
- [x] LIGHT-theme default surfaces
- [x] `package.json` renamed to `vorrai-app`
- [x] LabelService + dictionaries wired; sidebar binds reactively
- [x] AppWsService pretriage events + clinical aliases
- [x] User Pre-Triage tab + non-diagnostic disclaimer + structured summary view + verbatim consent snapshot view
- [x] Bookings dialog — Pre-Triage Ready badge wired to `pretriage_status`
- [ ] Deeper rebrand of pages that still carry sales-vertical copy (chats, leads, content) — iterate post-launch
- [ ] Logos / favicon — Vorrai assets in `public/assets/`; wire favicon + masthead next
- [ ] DNS for `app.vorrai.co`
- [ ] `push.sh` updated for the new deploy target
