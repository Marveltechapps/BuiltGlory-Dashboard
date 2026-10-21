# BuiltGlory Admin Dashboard — Backend Handoff

These documents describe **exactly what the frontend (`BG-Dashboard-Frontend`) expects from the backend**, derived from the source code (`src/services/**`, `src/types/**`, `src/modules/**`). Use them as the contract when building / verifying the backend.

| File | What it covers |
| --- | --- |
| [01-API-CONTRACT.md](01-API-CONTRACT.md) | Transport conventions (envelope, errors, pagination, auth/refresh) and **every endpoint** the dashboard calls, with method, path, query, request body and the response fields it reads |
| [02-DATA-MODELS.md](02-DATA-MODELS.md) | The record shapes (Mongo documents) the frontend maps — field names, fallbacks, enums, nested free-form objects |
| [03-WORKFLOWS.md](03-WORKFLOWS.md) | Business logic & state machines: enquiries, sell requests → acquisitions → properties, buy enquiries → sales deals, payments, visits, callbacks, interior, support, tools/CMS config |
| [04-AUTH-PERMISSIONS.md](04-AUTH-PERMISSIONS.md) | Admin login/session/refresh, roles, permission strings, which route needs which permission, edit locks |

## Stack facts that affect the backend

- SPA (React 19 + Vite). The browser **always calls same-origin `/api/...`**; in dev Vite proxies `/api` → `VITE_API_URL` (default `http://localhost:5001`). In production a reverse proxy must forward `/api/*` to the backend. No CORS needed if served same-origin.
- All endpoints are versioned under **`/api/v1`**. Admin endpoints are under **`/api/v1/admin/...`**.
- IDs are **MongoDB ObjectIds** (24-hex). The UI validates `/^[a-f0-9]{24}$/i` before calling lock/log endpoints, and treats `400`/`404`/`422` on a detail GET as "Not found".
- Every record should expose a human-friendly **`referenceId`** (e.g. `BE-1023`); the UI falls back to `_id` if missing.
- Populated refs are welcome: wherever the UI reads `xxxId`, it accepts either a string id **or** a populated object `{ _id, name, email, phone, ... }`. It prefers `xxxSnapshot` objects when present (e.g. `buyerSnapshot`, `propertySnapshot`, `sellerSnapshot`, `userSnapshot`).
- Dates: any value parseable by `new Date()` (ISO-8601 strongly preferred). Date-only fields (e.g. `visitDate`) may be `YYYY-MM-DD`.
- Money: plain numbers in **INR** (rupees, not paise).

## Endpoint count at a glance

~150 distinct method+path combinations across: auth, overview, search, notifications, buy-enquiries, sell-requests, visits, callbacks, interior leads, negotiation chats, acquisitions, sales deals, payments, properties (+ bulk import), users, admins, sales-team, designers, settings, content (CMS), message templates, bulk messages, communication logs, workflow logs/timeline/locks/proofs, support tickets, feedback, audit logs, reports & exports.
