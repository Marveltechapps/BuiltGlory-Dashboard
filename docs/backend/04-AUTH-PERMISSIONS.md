# 04 — Auth, Sessions & Permissions

Sources: `src/services/auth/authService.ts`, `src/store/authStore.ts`, `src/lib/apiClient.ts`, `src/constants/permissions.ts`, `src/app/router/guards.tsx`, `src/hooks/useEditLock.ts`.

---

## 1. Login flow

1. Login screen loads `GET /api/v1/public/admin-login-stats` (public) → `{ properties, users, deals }`.
2. Admin submits email + password (client enforces min 8 chars) → `POST /api/v1/auth/admin/login`.
3. Response `data`:
   ```json
   {
     "accessToken": "jwt…",
     "refreshToken": "opaque-or-jwt…",
     "expiresInSeconds": 900,
     "admin": { "_id": "…", "name": "Asha", "email": "asha@builtglory.com", "role": "sales_manager", "permissions": ["sales.read", "…"] }
   }
   ```
4. Stored in `localStorage["builtglory-admin-auth"]` together with `loggedInAt` and `accessTokenExpiresAt`.
5. Redirect to `?redirect=` (only if it starts with `/admin`) or `/admin/overview`.

Error handling: show `error.message` (e.g. "Invalid email or password", "Account suspended"). 🛠 Rate-limit login attempts.

## 2. Refresh & logout
- Any `401` on an authenticated call → single shared `POST /api/v1/auth/refresh { refreshToken }` → new `{ accessToken, refreshToken, expiresInSeconds }` → original request retried once.
- If refresh fails → session cleared → `/login?reason=timeout&redirect=…`.
- Logout → `POST /api/v1/auth/logout { refreshToken }` → `{ revoked: true }`.
- 🛠 Rotate refresh tokens; revoke on logout; reject refresh for suspended/removed admins.

## 3. Device sessions
- `GET /admin/sessions` → list with `current: true` for the caller's session (match by `sid` claim in the access token).
- `DELETE /admin/sessions/:sid` → revoke one. `DELETE /admin/sessions` → revoke all except current.
- 🛠 Access-token JWT should carry `sub` (admin id), `sid` (session id), `role`.

## 4. Roles

```
super_admin | admin | operations | support | sales_manager | sales_executive | relationship_manager | designer
```

## 5. Permission strings

```
properties.read  properties.write  properties.publish
users.read  users.write  users.kyc.review  users.fema.review
enquiries.read  enquiries.write
acquisitions.read  acquisitions.write
sales.read  sales.write
support.read  support.write
admin.access.manage  audit.read
visits.read  visits.write
```

### Effective permissions (client rule — backend must match)
- `super_admin` → **all** permissions, always.
- Otherwise: if `admin.permissions` is a non-empty array → use it exactly; **else** fall back to the role default:

| Role | Default permissions |
| --- | --- |
| super_admin | all |
| admin | all except `admin.access.manage` |
| operations | properties.read/write, enquiries.read/write, acquisitions.read/write, support.read/write |
| support | users.read, support.read/write |
| sales_manager | properties.read, enquiries.read/write, sales.read/write, visits.read/write |
| sales_executive | properties.read, enquiries.read/write, sales.read/write |
| relationship_manager | users.read/write, users.kyc.review, users.fema.review, support.read/write, sales.read |
| designer | support.read/write |

When creating an admin, the UI sends `permissions: DEFAULT_ROLE_PERMISSIONS[role]` explicitly.

## 6. UI route → required permission (any-of)

| Route prefix | Requires |
| --- | --- |
| `/admin/overview` | — (any signed-in admin) |
| `/admin/enquiries/*`, `/admin/visits/*`, `/admin/callbacks/*` | enquiries.read |
| `/admin/acquisition/*` | acquisitions.read |
| `/admin/sales/*` | sales.read |
| `/admin/properties/add`, `/admin/properties/upload` | properties.write |
| `/admin/properties/*` | properties.read |
| `/admin/users/*` | users.read |
| `/admin/reports/export` | audit.read |
| `/admin/reports/*` | sales.read |
| `/admin/tools/*` | properties.write **or** support.write **or** admin.access.manage |
| `/admin/settings/access` | admin.access.manage |
| `/admin/settings/audit` | audit.read |
| `/admin/settings/feedback` | support.read |
| `/admin/settings/legal` | support.write |
| `/admin/settings/support/*` | support.read |
| `/admin/settings/general` | admin.access.manage |

## 7. Recommended backend enforcement (API → permission)

The UI only hides screens; **the backend must enforce**. Suggested mapping:

| Endpoint group | Read | Write |
| --- | --- | --- |
| buy-enquiries, sell-requests, callbacks, interior/leads, negotiations/chats | enquiries.read | enquiries.write |
| visits | visits.read **or** enquiries.read | visits.write **or** enquiries.write |
| acquisitions | acquisitions.read | acquisitions.write |
| sales/deals, payments | sales.read | sales.write |
| properties (+media, bulk, import-jobs) | properties.read | properties.write (status `available` / publish → properties.publish optional) |
| users | users.read | users.write; `/fema` → users.fema.review; KYC → users.kyc.review |
| support/tickets, feedback | support.read | support.write |
| admins, admins/*/permissions, sales-team, settings (PATCH), sessions of others | admin.access.manage | admin.access.manage |
| audit-logs, reports/exports | audit.read | audit.read |
| reports/*/analytics | sales.read | — |
| content, message-templates, bulk-messages, notifications/push | properties.write \| support.write \| admin.access.manage | same |
| workflow logs/timeline/locks/proofs/email/push | read permission of the `:entityType`'s group | write permission of that group |
| overview, search, notifications (own), settings (GET), sales-team (GET), designers (GET) | any authenticated admin | — |

Return `403 { error: { code: 'FORBIDDEN', message } }` when denied (UI shows the message; 4xx is not retried).

## 8. Edit locks (soft concurrency)
- `GET /admin/workflow/:type/:id/lock` → current lock or `null`.
- `POST …/lock { ttlSeconds: 1800 }` → if free or own: create/extend and return with `isMine: true`; if someone else holds it: return **their** lock with `isMine: false` (status 200, not an error).
- `DELETE …/lock` → release if owner → `{ released: true }`.
- Locks are informational only; writes are not blocked.

## 9. Security notes for the backend
- Never return `passwordHash`.
- Report download URLs must be short-lived signed tokens (fetched without the Authorization header).
- Uploaded proof/document URLs must be persistent but ideally not guessable (signed or access-controlled).
- Validate ObjectIds (`400` on bad id → UI shows "Not found").
- Log every admin mutation to the audit trail with IP + user agent.
