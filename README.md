# vorrai-app — Clinical Dashboard

Vorrai Clinical's doctor / clinic-staff dashboard, served at **`app.vorrai.co`**. Forked from `vendia_app/` (legacy at `app.vendia.vip`). The two apps share the same `vendia-api` backend; routing is JWT-tenant-scoped.

## Run locally

```bash
npm install
ng serve
```

App runs on `http://localhost:4200`. Defaults to LIGHT theme (Marble White surfaces). The dark theme is still available via the settings toggle — it persists under `localStorage['vorrai-theme']` (legacy key `vendia-theme` is honoured for users migrating from vendia_app).

## Vorrai Clinical features layered on top of the fork

- **Pre-Triage tab** in the user-chat page (`src/app/pages/users/user-chat/`) — surfaces structured patient self-report + verbatim consent snapshot once the AI has captured the booked patient's intake.
- **Pre-Triage Ready badge** in the booking detail dialog (`src/app/pages/bookings/bookings.html`) — flips when `CalendarEventDAO.pretriage_status` is `complete` (or shows `requires_human` / `in_progress`).
- **WebSocket events** added to `app-ws.service.ts`: `pretriage_complete`, `pretriage_requires_human`. Both emitted by `vendia-agent`'s `FlowChatPreTriage` flow.
- **API**: `GET /dashboard/users/{user_id}/pretriage` returns the latest triage record. `POST /dashboard/users/{user_id}/pretriage/review` flips status to `reviewed`.

## Status

Phase D of the Vorrai clinical pivot has shipped:

- [x] Repo forked from `vendia_app`
- [x] index.html title + LIGHT-theme default
- [x] package.json renamed to `vorrai-app-clinical`
- [x] AppWsService updated for pretriage events
- [x] User Pre-Triage tab + non-diagnostic disclaimer + structured summary view + verbatim consent snapshot view
- [x] Bookings dialog — Pre-Triage Ready badge wired to `pretriage_status`
- [ ] Deeper rebrand of pages that still carry sales-vertical copy (chats, leads, content) — iterate post-launch
- [ ] Logos / favicon — currently still vendia_app's
- [ ] Hosting target chosen + DNS for `app.vorrai.co`
- [ ] `push.sh` updated for the new deploy target
