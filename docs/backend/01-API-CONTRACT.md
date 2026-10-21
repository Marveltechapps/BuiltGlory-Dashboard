# 01 — API Contract

Source of truth: `src/lib/apiClient.ts`, `src/lib/paging.ts`, `src/services/**`.

---

## 1. Transport conventions

### 1.1 Base URL
Browser calls `/api/<path>`. Services pass paths like `/v1/admin/...`, so the full URL is **`/api/v1/admin/...`**.

### 1.2 Request headers
| Header | When |
| --- | --- |
| `Accept: application/json` | always |
| `Authorization: Bearer <accessToken>` | every call except those marked **public** |
| `Content-Type: application/json` | when a JSON body is sent |
| (multipart boundary, set by browser) | file uploads (`FormData`) |

### 1.3 Success envelope (REQUIRED)
```json
{
  "data": <object | array>,
  "meta": { "requestId": "…", "page": 1, "limit": 100, "total": 245, "totalPages": 3 }
}
```
- The client unwraps `data`. If the body has no `data` key, the whole body is used as data (tolerated, but use the envelope).
- `meta` is **required on list endpoints** (`total`, `totalPages`, `page`, `limit`) — the UI uses it for counts and paging.

### 1.4 Error envelope (REQUIRED)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [ { "field": "body.email", "message": "must be a valid email" } ]
  },
  "meta": { "requestId": "…" }
}
```
- `error.message` is shown in toasts.
- If `details` is an array of `{ field, message }`, the UI prints `field: message` joined by `. ` and strips `body.` / `query.` / `params.` prefixes (Joi-style).
- Status code semantics the UI relies on:
  - `401` → triggers one refresh attempt (see §1.6), then logout with "session timed out".
  - `4xx` → **not retried** by React Query.
  - `5xx` / network → retried once.
  - `400` / `404` / `422` on a **detail GET** → page shows "Not found".

### 1.5 Pagination & list query params
Most list endpoints are called through `fetchAllPages()`:
- Sends `?limit=100&page=N&sort=newest` (plus filters), loops until `page >= meta.totalPages` or an empty page, max **10 pages** (5 for content/tickets/feedback).
- So: support `page`, `limit` (≤100 at least), `sort=newest` (createdAt desc).
- Array query params are sent as **repeated keys**: `?channel=whatsapp&channel=email`.
- Empty/null/undefined params are omitted.

Some endpoints are called with a single page (`limit=20`, `limit=50`, `limit=6`, `limit=1`) — `limit=1` is used purely to read `meta.total` as a record count.

### 1.6 Token refresh
On a `401` for an authenticated call (and only once per call):
```
POST /api/v1/auth/refresh
{ "refreshToken": "<stored refresh token>" }
→ 200 { "data": { "accessToken": "...", "refreshToken": "...", "expiresInSeconds": 900 } }
```
Concurrent 401s share a single refresh request. If refresh fails, the session is wiped and the user is redirected to `/login?reason=timeout`. **Refresh tokens should rotate** (the client stores the new one).

### 1.7 File uploads
- `multipart/form-data`, no JSON content-type.
- Field names: `files` (multiple, property media, up to 20), `file` (single — bulk upload, proof upload).

### 1.8 Mutation responses
Unless noted, every `PATCH`/`POST` on a record **must return the full updated record** (same shape as the detail GET). The UI maps the response directly and re-renders from it.

---

## 2. Auth & sessions

| # | Method | Path | Auth | Body | Response `data` |
| --- | --- | --- | --- | --- | --- |
| A1 | POST | `/v1/auth/admin/login` | public | `{ email, password }` (password min 8) | `{ accessToken, refreshToken, expiresInSeconds, admin: { _id/id, name, email, role, permissions[] } }` |
| A2 | POST | `/v1/auth/refresh` | public | `{ refreshToken }` | `{ accessToken, refreshToken, expiresInSeconds }` |
| A3 | POST | `/v1/auth/logout` | bearer | `{ refreshToken }` | `{ revoked: boolean }` |
| A4 | GET | `/v1/public/admin-login-stats` | public | — | `{ properties: number, users: number, deals: number }` (shown on login screen) |
| A5 | GET | `/v1/admin/sessions` | bearer | — | `AdminDeviceSession[]`: `{ sid, type, role, deviceId?, userAgent?, ip?, status, createdAt, lastSeenAt, current: boolean }` |
| A6 | DELETE | `/v1/admin/sessions/:sid` | bearer | — | `{ revoked: boolean, sid }` |
| A7 | DELETE | `/v1/admin/sessions` | bearer | — (revoke all *other* sessions) | `{ revoked: number }` |

> Never return `passwordHash` in `admin` (the client strips it defensively, but don't send it).

---

## 3. Overview, search, notifications

| # | Method | Path | Query / Body | Response `data` |
| --- | --- | --- | --- | --- |
| O1 | GET | `/v1/admin/overview` | — | `AdminOverview` (see below) |
| O2 | GET | `/v1/admin/search` | `q` (2–100 chars), `limit` (≤20; UI sends 12) | `SearchResult[]` |
| N1 | GET | `/v1/admin/notifications` | `limit` (20 or 100), `sort=newest` | `Notification[]` |
| N2 | PATCH | `/v1/admin/notifications/:id` | `{ isRead: true }` | notification |
| N3 | POST | `/v1/admin/notifications/push` | `SendPushBody` (one user per call) | notification/delivery record |
| N4 | POST | `/v1/admin/notifications/:id/retry` | `{}` | record |

### `AdminOverview` (all keys optional; UI handles missing)
```ts
{
  kpis: { activeProperties, featuredProperties, upcomingProperties, newEnquiries, tokenPaidDeals,
          closedDeals, revenue, overdueCallbacks, openSupportTickets, pendingKycUsers, pendingSellRequests },
  schedule: [{ id, referenceId, buyerName, buyerPhone, propertyTitle, visitDate, visitTime, visitType, status, viewPath }],
  recentActivities: [{ id, description, time, route, resourceType, action }],
  pipelineCounts: { acquisitions: [{ value: stage, count }], sales: [{ value: stage, count }] },
  chartSeries: {
    enquiriesLast7Days: [{ date, day: "Mon", count }],
    propertiesByType:   [{ value: type, count }]
  },
  recentEnquiries:  [{ id, referenceId, buyer, property, type, date, status, viewPath }],
  pendingApprovals: [{ id, referenceId, seller, title, type, submitted, status, viewPath }],
  slaQueues: {
    enquiries | stagePayments | interiorLeads: [{
      id, name, property, phone, viewPath, sourceTime, limitHours, elapsedHours,
      remainingHours, progressPercent, status: "ok" | "warning" | "breached" }]
  },
  navBadges: { enquiries?: n, acquisition?: n, sales?: n, properties?: n, users?: n, reports?: n, tools?: n, admin?: n }
}
```
- `viewPath` values are dashboard routes, e.g. `/admin/enquiries/buy/<id>`, `/admin/visits/<id>`, `/admin/enquiries/sell/<id>`.
- `navBadges` keys = sidebar section ids above (counts shown as red badges, 99+ capped).
- SLA hours come from settings `sla.enquiryHours / stagePaymentHours / interiorHours`.

### `SearchResult`
`{ type: 'property'|'user'|'enquiry'|'acquisition'|'deal', id, title, subtitle, route, emoji }` — `route` is the dashboard path to open.

### `Notification` (raw fields read)
`_id, event, channel ('in_app'|'push'|'email'|...), payload{ title, message, route, icon, referenceId, status, userName, notificationType, audience, body }, status, isRead, readAt, openedAt, createdAt, sentAt, userId (populated {name}), title, message, notificationType, audience, failureReason`.

Known `event` values with built-in UI mapping: `enquiry_created`, `sell_request_submitted`, `visit_scheduled`, `callback_overdue`, `support_ticket_created`, `token_payment_created`, `bulk_message`. Others are title-cased.

> ⚠️ The list validator has no `channel` filter — the Push tab fetches 100 and filters `channel === 'push'` client-side. **Recommended:** add `?channel=push` support.

### `SendPushBody`
```ts
{ userId: string (required), audience?: 'buyer'|'seller', notificationType?: string, title: string, message: string,
  screen?: string, propertyId?, dealId?, enquiryId?, entityId?, entityType?: string, dedupeKey?: string }
```
Used e.g. for price-drop alerts (`notificationType: 'price_drop'`, `entityType: 'property'`) to every user in `property.savedByUsers`.

---

## 4. Enquiries

### 4.1 Buy enquiries
| Method | Path | Query/Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/buy-enquiries` | `page, limit, sort=newest`, optional filters | `BuyEnquiry[]` + meta |
| GET | `/v1/admin/buy-enquiries/:enquiryId` | — | `BuyEnquiry` |
| PATCH | `/v1/admin/buy-enquiries/:enquiryId` | `{ status?, assignedTo?, preferredContact?, notes? }` | `BuyEnquiry` |
| POST | `/v1/admin/buy-enquiries/:enquiryId/convert-to-deal` | — | created deal (`{ deal: {...} }` or the deal itself) — UI reads `_id` |

`status` ∈ `new | responded | visit_scheduled | negotiating | closed`.

### 4.2 Sell requests
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/sell-requests` | list | `SellRequest[]` |
| GET | `/v1/admin/sell-requests/:sellRequestId` | — | `SellRequest` |
| PATCH | `/v1/admin/sell-requests/:sellRequestId` | `{ assignedTo: id \| null }` (assignment only) | `SellRequest` |
| PATCH | `/v1/admin/sell-requests/:sellRequestId/review` | `SellReviewBody` | `SellRequest` |
| POST | `/v1/admin/sell-requests/:sellRequestId/create-acquisition` | — | `{ acquisition: {...} }` or acquisition; UI reads `_id`, `referenceId` |

```ts
SellReviewBody = {
  decision: 'under_review'|'changes_requested'|'rejected'|'accepted'|'approved'|'active'|'negotiating'|'paused'|'sold',
  notes?, reason?, rejectionReason?, pauseReason?, changeRequests?: string[],
  salePrice?: number, saleDate?: string, saleBuyerName?: string   // when decision = 'sold'
}
```
The backend should set `status = decision` and persist the reason fields (`rejectionReason`, `pauseReason`, `changeRequests`, `sale.{salePrice,saleDate,buyerName}`).

### 4.3 Visits
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/visits` | list | `Visit[]` |
| GET | `/v1/admin/visits/:visitId` | — | `Visit` |
| PATCH | `/v1/admin/visits/:visitId/status` | `VisitStatusBody` | `Visit` |
| POST | `/v1/admin/visits/:visitId/feedback` | `{ feedback: { buyerInterest, notes, nextAction }, notes?, outcome? }` | `Visit` |
| POST | `/v1/admin/visits/:visitId/call-logs` | `{ outcome?, notes? }` | `Visit` |

```ts
VisitStatusBody = {
  status: 'scheduled'|'confirmed'|'completed'|'cancelled'|'missed'|'rescheduled',   // required (UI resends current status for partial edits)
  visitDate?: 'YYYY-MM-DD', visitTime?: 'HH:mm' (24h), notes?, reason?, cancelReason?,
  meetingLink?: string|null, virtualPlatform?: 'zoom'|'google_meet'|'teams'|'whatsapp_video'|null,
  assignedAdmin?: id, feedback?: { buyerInterest, notes, nextAction },
  virtualRecordingUrl?, callDuration?: number|null, callNotes?, documentsShared?: string[],
  followUpAction?, followUpDate?, completedAt?, nriChecklist?: Record<string, boolean>,
  nriAssistanceNotes?, reminderSent?: boolean,
  callLog?: { outcome?, notes?, duration?, calledAt? },   // append to callLogs[]
  note?: { text }                                          // append to notes[]
}
```
On `status: 'rescheduled'` with new date/time, **push an entry onto `rescheduleHistory`** `{ previousDate, previousTime, newDate, newTime, reason, changedAt }`.

### 4.4 Callbacks
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/callbacks` | list | `Callback[]` |
| GET | `/v1/admin/callbacks/:callbackId` | — | `Callback` |
| POST | `/v1/admin/callbacks/:callbackId/attempts` | `{ outcome?: 'answered'\|'no_answer'\|'busy'\|'wrong_number'\|'callback_later', notes?, assignedTo? }` | `Callback` |
| PATCH | `/v1/admin/callbacks/:callbackId/resolve` | `{ resolutionNotes, notes }` (same text) | `Callback` |
| PATCH | `/v1/admin/callbacks/:callbackId/reschedule` | `{ preferredTime, reason, notes? }` | `Callback` |

### 4.5 Interior leads
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/interior/leads` | list | `InteriorLead[]` |
| GET | `/v1/admin/interior/leads/:leadId` | — | `InteriorLead` |
| PATCH | `/v1/admin/interior/leads/:leadId` | see below | `InteriorLead` |

```ts
{ status?: 'new'|'contacted'|'quote_sent'|'accepted'|'negotiating'|'declined'|'completed',
  assignedDesigner?: id|null, notes?: string|null,
  quote?: { amount: number, packageName, timeline, inclusions: string[], validUntil: ISO },
  customerAcceptedAt?: ISO, completionNote?: string }
```

### 4.6 Negotiation chats
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/negotiations/chats` | list | `ChatThread[]` |
| GET | `/v1/admin/negotiations/chats/:threadId` | — | `ChatThread` (with `messages[]`) |
| POST | `/v1/admin/negotiations/chats/:threadId/messages` | `{ text, type?: 'text'\|'offer'\|'deal_agreed', offerAmount? }` | any (UI refetches) |

When `type = 'deal_agreed'`, backend should set thread `status = 'deal_agreed'` and `negotiation.agreedPrice = offerAmount`.

---

## 5. Acquisition pipeline

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/acquisitions` | list (`sort=newest`) | `Acquisition[]` |
| GET | `/v1/admin/acquisitions/:acquisitionId` | — | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId` | any of `{ assignedTo, priority, builtgloryOffer, agreedPrice, finalPurchasePrice, notes, documentation, … }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/stage` | `{ stage, notes?, reason?, rejectionReason?, onHoldReason?, agreedPrice?, finalPurchasePrice?, valuation?, negotiation? }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/valuation` | `{ valuation: {...}, builtgloryOffer? }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/negotiation` | `{ negotiation: {...}, builtgloryOffer? }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/token` | `{ token: {...} }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/documentation` | `{ documentation: {...} }` | `Acquisition` |
| PATCH | `/v1/admin/acquisitions/:acquisitionId/payout` | `{ payout: {...} }` | `Acquisition` |
| POST | `/v1/admin/acquisitions/:acquisitionId/convert-to-property` | — | `{ property: {...} }` or property; UI reads `_id` |

Section endpoints: the body is **wrapped in the section key** plus optional top-level extras. The section object is sent **whole** (client merges then sends) — backend should **replace** the section object (or deep-merge; both work because the client sends the full object).

`/stage` with extra fields: stage-change requests may carry other fields (e.g. `valuation`, `negotiation`, `agreedPrice`, `finalPurchasePrice`, `rejectionReason: ''` to clear). **Accept and persist them in the same update**, and append to `stageHistory` `{ from, to, changedAt, notes }`, set `lastActivityAt`.

> Note: `updateAcquisition` (PATCH root) is used to save `documentation` (whole object, including `documentation.workflow` sub-object). Make sure the root PATCH validator allows `documentation` as a free-form object.

---

## 6. Sales pipeline & payments

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/sales/deals` | list | `SalesDeal[]` |
| GET | `/v1/admin/sales/deals/:dealId` | — | `SalesDeal` |
| POST | `/v1/admin/sales/deals` | `CreateDealBody` | `SalesDeal` |
| GET | `/v1/admin/sales/deals/:dealId/recommendations` | `limit=6` | `[{ _id, title, price, type, location \| locality+city, coverPhoto, score, reason }]` |
| PATCH | `/v1/admin/sales/deals/:dealId` | `{ assignedTo?, priority?, offeredPrice?, agreedPrice?, notes?, reengagement?, documentation? }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/stage` | `{ stage, notes?, reason?, lostReason?, agreedPrice?, reengagement? }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/offer` | `{ offeredPrice?, agreedPrice?, notes? }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/token-payment` | `{ tokenAmount?, tokenPaid?, tokenPayment?: object\|null }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/payment-plan` | `{ paymentType?: 'full'\|'stage', totalPaid?, fullPayment?, stagePayment?, interiorDesign? }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/documentation` | `{ documentation }` | `SalesDeal` |
| PATCH | `/v1/admin/sales/deals/:dealId/close` | `{}` | `SalesDeal` (set `stage='closed'`, `closedAt`) |
| PATCH | `/v1/admin/sales/deals/:dealId/lost` | `{ lostReason, notes? }` | `SalesDeal` (set `stage='lost'`, `lostAtStage`) |
| GET | `/v1/admin/payments` | `dealId?, status?, type?, limit=50, sort=newest` | `AdminPayment[]` |
| PATCH | `/v1/admin/payments/:paymentId/verify` | `{ decision: 'paid'\|'rejected', notes? }` | `AdminPayment` |

```ts
CreateDealBody = {
  buyerId: id, propertyId: id, sourceEnquiryId?, stage?, priority?: 'normal'|'high'|'urgent', assignedTo?,
  buyerSnapshot?: { name, phone, email, userType: 'resident'|'nri'|'pio' },
  propertySnapshot?: { title, type, location, price },
  financials?: { offeredPrice?, agreedPrice? }
}
```
Financial fields may live at the top level or under `financials` — the UI reads `financials.X ?? X`. Store under `financials` and return there.

---

## 7. Properties

| Method | Path | Query/Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/properties` | `page, limit, sort=newest, includeDeleted=true`, filters `status, locality, city, type, …` | `Property[]` |
| GET | `/v1/admin/properties/:propertyId` | — | `Property` |
| POST | `/v1/admin/properties` | `PropertyPayload` (title, type, price required) | `Property` |
| PATCH | `/v1/admin/properties/:propertyId` | `PropertyPayload` (partial) | `Property` |
| DELETE | `/v1/admin/properties/:propertyId` | — (soft delete: `isDeleted=true`, `deletedAt`) | any |
| PATCH | `/v1/admin/properties/:propertyId/restore` | — | any |
| DELETE | `/v1/admin/properties/:propertyId/permanent` | — (hard delete) | any |
| PATCH | `/v1/admin/properties/:propertyId/status` | `{ status: 'available'\|'sold'\|'reserved'\|'under_construction'\|'draft', reason?, notes?, override? }` | `Property` |
| POST | `/v1/admin/properties/:propertyId/media` | multipart: `files[]` (≤20), `documentType` (default `photo`) | `{ property }` or `Property` |
| POST | `/v1/admin/properties/bulk-upload` | multipart: `file` (xlsx/csv) | `{ valid, rowsAccepted, rowsRejected, errors: [{row, field, message}], job?: ImportJob }` |
| GET | `/v1/admin/properties/bulk-template` | `mode=empty\|valued`, `limit=100` | `{ mode, fields: [{ key, label, required, editable, type }], rows: [ {key: value} ] }` |
| GET | `/v1/admin/properties/import-jobs` | `limit=20` | `ImportJob[]` |
| POST | `/v1/admin/import-jobs/:id/undo` | — | `{ job: ImportJob, revertedCount }` |

> ⚠️ `PATCH /properties/:id` with `media` **replaces** the media object — the client merges before sending.
> Filter `findProperties` calls use `limit=6` (similar in locality) and `status=available&limit=20` (alternatives for lost deals).

---

## 8. Users (app customers)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/users` | list | `User[]` |
| GET | `/v1/admin/users/:userId` | — | `User` |
| GET | `/v1/admin/users/:userId/export` | — | any JSON (downloaded as file) |
| PATCH | `/v1/admin/users/:userId` | `{ name?, email?, city?, state?, country?, userType?, role?, status?, notes? }` | `User` |
| PATCH | `/v1/admin/users/:userId/block` | `{ isBlocked, blockedReason }` | `User` |
| PATCH | `/v1/admin/users/:userId/assign` | `{ assignedTo }` | `User` |
| PATCH | `/v1/admin/users/:userId/fema` | `{ status: 'not_checked'\|'compliant'\|'non_compliant'\|'under_review', notes? }` | `User` (set `femaCompliance.checkedBy = admin`, `checkedAt = now`) |

---

## 9. Admin team

### 9.1 Admin accounts
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/admins` | — | `AdminOperator[]` |
| POST | `/v1/admin/admins/invite` | `AdminPayload` | `AdminOperator` |
| PATCH | `/v1/admin/admins/:id` | `AdminPayload` partial (e.g. `{ isAvailable }`, `{ name, role }`) | `AdminOperator` |
| PATCH | `/v1/admin/admins/:id/permissions` | `{ permissions: string[] }` | `AdminOperator` |
| POST | `/v1/admin/admins/:id/reset-password` | `{ password }` (min 8) | any |
| POST | `/v1/admin/admins/:id/suspend` | `{ suspended: boolean }` | `AdminOperator` |
| DELETE | `/v1/admin/admins/:id` | — | any |

```ts
AdminPayload = { name?, email?, phone?, photoUrl?, password?, role?, department?, assignedArea?: string[],
                 specialization?: string[], isAvailable?: boolean, status?: 'active'|'suspended', permissions?: string[] }
AdminOperator (raw) = { _id, name, email, phone, role, department, permissions[], assignedArea[], status, isActive, lastLoginAt, createdAt }
```
Flow: "Add Admin" = `invite` (no password) → then `reset-password` with the chosen password. Designers are created through `invite` with `role: 'designer'`.

### 9.2 Sales team & designers
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/sales-team` | — | `TeamMember[]` (not paginated) |
| POST | `/v1/admin/sales-team` | `{ name, phone, email, role, assignedArea: string[] }` | `TeamMember` |
| PATCH | `/v1/admin/sales-team/:id` | partial `{ name, phone, email, role, assignedArea, isAvailable }` | `TeamMember` |
| DELETE | `/v1/admin/sales-team/:id` | — | any |
| GET | `/v1/admin/designers` | — | `TeamMember[]` |

`TeamMember` raw: `{ _id, name, phone, email, role, assignedArea[], activeWorkload: number, isAvailable, isActive, specialization[] }`. `activeWorkload` = open records assigned (computed by backend).

---

## 10. Settings, CMS content, messaging

### 10.1 Settings (single document)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/settings` | — | `AdminSettings` |
| PATCH | `/v1/admin/settings` | `AdminSettingsPatch` (deep-partial) | `AdminSettings` |

See [02-DATA-MODELS.md §Settings](02-DATA-MODELS.md#settings). Must **deep-merge** nested objects (`organization`, `app`, `sla`, `alerts`, `notifications`, `display`, `tools`). Arrays under `tools` (`boostPlans`, `interiorPackages`, `coupons`) are sent whole and replace.

### 10.2 Content (CMS)
| Method | Path | Query/Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/content` | `section?, sort=newest, page, limit` | `ContentItem[]` |
| POST | `/v1/admin/content` | `ContentPayload` (section, title required) | `ContentItem` |
| PATCH | `/v1/admin/content/:contentId` | `ContentPayload` partial | `ContentItem` |
| DELETE | `/v1/admin/content/:contentId` | — | any |
| PATCH | `/v1/admin/content/reorder` | `{ items: [{ id, order }] }` | any |

> Route order: register `/content/reorder` **before** `/content/:contentId`.

### 10.3 Message templates & bulk messages
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/message-templates` | — | `[{ _id, referenceId, name, channel, category, subject, body }]` |
| POST | `/v1/admin/message-templates` | `{ name, channel: 'whatsapp'\|'email'\|'sms', category, subject?, body }` | template |
| PATCH | `/v1/admin/message-templates/:id` | partial | template |
| DELETE | `/v1/admin/message-templates/:id` | — | any |
| GET | `/v1/admin/bulk-messages` | `limit=20` | `[{ _id, referenceId, message, channel, audience, recipients[] \| queuedCount \| recipientCount, requestedBy{name}, sentAt, createdAt, scheduledAt, status }]` |
| POST | `/v1/admin/bulk-messages` | `{ audience, channel, title?, message, recipients?: string[], templateId?, scheduledAt? }` | bulk record |
| GET | `/v1/admin/communication-logs` | `limit=100, channel=whatsapp&channel=email&channel=message, direction=outbound, search?` | `WorkflowLog[]` |

---

## 11. Workflow: logs, timeline, email, push, proofs, locks

`:entityType` ∈ `buy_enquiry | sell_request | acquisition | sales_deal | visit | callback | interior_lead | support_ticket | user | property`.

| Method | Path | Query/Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/workflow/:entityType/:entityId/logs` | `channel?`, `limit=100` | `WorkflowLog[]` |
| POST | `/v1/admin/workflow/:entityType/:entityId/logs` | `CreateLogBody` | `WorkflowLog` |
| DELETE | `/v1/admin/workflow/logs/:logId` | — | any |
| GET | `/v1/admin/:entityType/:entityId/timeline` | `limit=50` | `WorkflowLog[]` (activity: stage changes, updates, logs) |
| POST | `/v1/admin/workflow/:entityType/:entityId/email` | `{ to, subject, body, summary? }` — **backend actually sends the email** and logs it | `WorkflowLog` |
| POST | `/v1/admin/workflow/:entityType/:entityId/push` | `{ userId?, recipient?, notificationId: 'N-02', audience?, template: { title, body, deepLink? } }` | `WorkflowLog` |
| POST | `/v1/admin/workflow/:entityType/:entityId/proofs` | multipart `file`, `summary?`, `notes?` — store file, create `proof_upload` log | `WorkflowLog` with `attachments[0].url` |
| GET | `/v1/admin/workflow/:entityType/:entityId/lock` | — | `EditLock \| null` |
| POST | `/v1/admin/workflow/:entityType/:entityId/lock` | `{ ttlSeconds: 1800 }` | `EditLock \| null` (existing lock if held by someone else) |
| DELETE | `/v1/admin/workflow/:entityType/:entityId/lock` | — | `{ released: boolean }` |

```ts
CreateLogBody = { channel: 'call'|'note'|'message'|'push'|'email'|'whatsapp'|'proof_upload',
                  direction?: 'inbound'|'outbound'|'internal', summary: string (≤300), body?: string|null,
                  outcome?: string|null, durationMinutes?: number, followUpAt?: ISO|null, occurredAt?: ISO }
WorkflowLog (raw) = { _id, entityType, entityId, channel, direction, summary, body, outcome, durationMinutes,
                      occurredAt, createdAt, actorName, actorId{name,email}, attachments: [{ fileName, url, mimeType, sizeBytes }] }
EditLock = { id, adminId, adminName, lockedAt, expiresAt, isMine: boolean }
```
The proof upload URL is reused as a document URL (legal docs, certificates), so it must be a **persistent, fetchable URL**.

> Route order: `/workflow/logs/:logId` must not collide with `/workflow/:entityType/:entityId/logs`.

---

## 12. Support, feedback, audit

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/support/tickets` | list | `SupportTicket[]` |
| GET | `/v1/admin/support/tickets/:ticketId` | — | `SupportTicket` |
| POST | `/v1/admin/support/tickets/:ticketId/responses` | `TicketUpdate` (normally `{ message, status? }`) | `SupportTicket` |
| PATCH | `/v1/admin/support/tickets/:ticketId` | `TicketUpdate` | `SupportTicket` |
| POST | `/v1/admin/support/tickets/:ticketId/read` | — | any |
| POST | `/v1/admin/support/tickets/:ticketId/close` | — | any |
| POST | `/v1/admin/support/tickets/:ticketId/reopen` | — | any |
| GET | `/v1/admin/feedback` | list | `Feedback[]` |
| PATCH | `/v1/admin/feedback/:id` | `{ status: 'new'\|'reviewed'\|'archived' }` | any |
| GET | `/v1/admin/audit-logs` | `limit=100, sort=newest, search?` | `AuditEntry[]` + `meta.total` |

```ts
TicketUpdate = { message?, resolve?: boolean, status?: 'open'|'in_progress'|'resolved'|'closed',
                 priority?: 'low'|'medium'|'high'|'urgent', assignedTo?: id|null,
                 escalation?: { targetAssignee: id, reason: string } }
```
Responses: push `{ responderType: 'admin', responderId: <admin>, message, createdAt }` onto `responses[]`. If `resolve: true` set status `resolved`.

---

## 13. Reports & exports

| Method | Path | Query/Body | Response |
| --- | --- | --- | --- |
| GET | `/v1/admin/reports/sales/analytics` | `from?, to?, propertyType?` | `SalesAnalytics` |
| GET | `/v1/admin/reports/acquisition/analytics` | same | `AcquisitionAnalytics` |
| GET | `/v1/admin/reports/revenue/analytics` | same | `RevenueAnalytics` |
| GET | `/v1/admin/reports/exports` | `limit=20` | `ReportExport[]` |
| POST | `/v1/admin/reports/export` | `{ filters: { reportType, format, fields?, deliveryEmail?, estimatedRows? } }` | `ReportExport` |
| GET | `/v1/admin/reports/exports/:id/download-url` | — | `{ downloadUrl, fileName }` |
| GET | `/v1/admin/reports/exports/:id/download?token=…` | **public, tokenised** (fetched WITHOUT Authorization header) | binary file |

- `reportType` ∈ `properties | users | sales | sales_deals | acquisitions`; `format` ∈ `csv | xlsx | pdf`.
- Export is async: status `queued → processing → ready | failed` (UI polls every 5 s while any job is queued/processing). `expiresAt` shown.
- `downloadUrl` may be absolute (`https://…`), `/api/...`, or relative to `/api/v1`.

```ts
SalesAnalytics = {
  stats: { count, revenue, averageDealValue, conversion, pipelineCount, pipelineValue },
  monthlyClosedDeals: [{ month, deals, revenue }], monthlyDealActivity: [{ month, deals }],
  revenueByTypeAll | revenueByType: [{ type, revenue, deals }], pipelineByStage: [{ stage, count }],
  propertyComparison: [{ _id, title, type, address{locality,city}, media{photos[],coverPhoto}, metrics{views,enquiries,visits,compareCount} }]
}
AcquisitionAnalytics = { stats: { count, cost, averageCost, pipelineActive, incomingSellRequests },
                         stageCounts: [{ stage, count }], acquisitionByType: [{ type, value, count }] }
RevenueAnalytics = { stats: { revenue, cost, profit, margin },
                     revenueVsCost: [{ month, revenue, cost }], profitTrend: [{ month, profit }],
                     pendingPayments: [{ _id, referenceId, buyer, property, stage, amount, paid, balance, lastActivityAt }] }
```
Record counts on the Export tab: `GET /properties|/users|/sales/deals|/acquisitions?limit=1&page=1` → `meta.total`.

---

## 14. Complete endpoint checklist

```
POST   /api/v1/auth/admin/login                         (public)
POST   /api/v1/auth/refresh                             (public)
POST   /api/v1/auth/logout
GET    /api/v1/admin/sessions
DELETE /api/v1/admin/sessions
DELETE /api/v1/admin/sessions/:sid

GET    /api/v1/admin/overview
GET    /api/v1/admin/search
GET    /api/v1/admin/notifications
PATCH  /api/v1/admin/notifications/:id
POST   /api/v1/admin/notifications/push
POST   /api/v1/admin/notifications/:id/retry

GET    /api/v1/admin/buy-enquiries
GET    /api/v1/admin/buy-enquiries/:id
PATCH  /api/v1/admin/buy-enquiries/:id
POST   /api/v1/admin/buy-enquiries/:id/convert-to-deal

GET    /api/v1/admin/sell-requests
GET    /api/v1/admin/sell-requests/:id
PATCH  /api/v1/admin/sell-requests/:id
PATCH  /api/v1/admin/sell-requests/:id/review
POST   /api/v1/admin/sell-requests/:id/create-acquisition

GET    /api/v1/admin/visits
GET    /api/v1/admin/visits/:id
PATCH  /api/v1/admin/visits/:id/status
POST   /api/v1/admin/visits/:id/feedback
POST   /api/v1/admin/visits/:id/call-logs

GET    /api/v1/admin/callbacks
GET    /api/v1/admin/callbacks/:id
POST   /api/v1/admin/callbacks/:id/attempts
PATCH  /api/v1/admin/callbacks/:id/resolve
PATCH  /api/v1/admin/callbacks/:id/reschedule

GET    /api/v1/admin/interior/leads
GET    /api/v1/admin/interior/leads/:id
PATCH  /api/v1/admin/interior/leads/:id

GET    /api/v1/admin/negotiations/chats
GET    /api/v1/admin/negotiations/chats/:id
POST   /api/v1/admin/negotiations/chats/:id/messages

GET    /api/v1/admin/acquisitions
GET    /api/v1/admin/acquisitions/:id
PATCH  /api/v1/admin/acquisitions/:id
PATCH  /api/v1/admin/acquisitions/:id/stage
PATCH  /api/v1/admin/acquisitions/:id/valuation
PATCH  /api/v1/admin/acquisitions/:id/negotiation
PATCH  /api/v1/admin/acquisitions/:id/token
PATCH  /api/v1/admin/acquisitions/:id/documentation
PATCH  /api/v1/admin/acquisitions/:id/payout
POST   /api/v1/admin/acquisitions/:id/convert-to-property

GET    /api/v1/admin/sales/deals
POST   /api/v1/admin/sales/deals
GET    /api/v1/admin/sales/deals/:id
GET    /api/v1/admin/sales/deals/:id/recommendations
PATCH  /api/v1/admin/sales/deals/:id
PATCH  /api/v1/admin/sales/deals/:id/stage
PATCH  /api/v1/admin/sales/deals/:id/offer
PATCH  /api/v1/admin/sales/deals/:id/token-payment
PATCH  /api/v1/admin/sales/deals/:id/payment-plan
PATCH  /api/v1/admin/sales/deals/:id/documentation
PATCH  /api/v1/admin/sales/deals/:id/close
PATCH  /api/v1/admin/sales/deals/:id/lost
GET    /api/v1/admin/payments
PATCH  /api/v1/admin/payments/:id/verify

GET    /api/v1/admin/properties
POST   /api/v1/admin/properties
GET    /api/v1/admin/properties/bulk-template
POST   /api/v1/admin/properties/bulk-upload
GET    /api/v1/admin/properties/import-jobs
GET    /api/v1/admin/properties/:id
PATCH  /api/v1/admin/properties/:id
DELETE /api/v1/admin/properties/:id
PATCH  /api/v1/admin/properties/:id/restore
DELETE /api/v1/admin/properties/:id/permanent
PATCH  /api/v1/admin/properties/:id/status
POST   /api/v1/admin/properties/:id/media
POST   /api/v1/admin/import-jobs/:id/undo

GET    /api/v1/admin/users
GET    /api/v1/admin/users/:id
GET    /api/v1/admin/users/:id/export
PATCH  /api/v1/admin/users/:id
PATCH  /api/v1/admin/users/:id/block
PATCH  /api/v1/admin/users/:id/assign
PATCH  /api/v1/admin/users/:id/fema

GET    /api/v1/admin/admins
POST   /api/v1/admin/admins/invite
PATCH  /api/v1/admin/admins/:id
PATCH  /api/v1/admin/admins/:id/permissions
POST   /api/v1/admin/admins/:id/reset-password
POST   /api/v1/admin/admins/:id/suspend
DELETE /api/v1/admin/admins/:id
GET    /api/v1/admin/sales-team
POST   /api/v1/admin/sales-team
PATCH  /api/v1/admin/sales-team/:id
DELETE /api/v1/admin/sales-team/:id
GET    /api/v1/admin/designers

GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings
GET    /api/v1/admin/content
POST   /api/v1/admin/content
PATCH  /api/v1/admin/content/reorder
PATCH  /api/v1/admin/content/:id
DELETE /api/v1/admin/content/:id
GET    /api/v1/admin/message-templates
POST   /api/v1/admin/message-templates
PATCH  /api/v1/admin/message-templates/:id
DELETE /api/v1/admin/message-templates/:id
GET    /api/v1/admin/bulk-messages
POST   /api/v1/admin/bulk-messages
GET    /api/v1/admin/communication-logs

GET    /api/v1/admin/workflow/:entityType/:entityId/logs
POST   /api/v1/admin/workflow/:entityType/:entityId/logs
DELETE /api/v1/admin/workflow/logs/:logId
GET    /api/v1/admin/:entityType/:entityId/timeline
POST   /api/v1/admin/workflow/:entityType/:entityId/email
POST   /api/v1/admin/workflow/:entityType/:entityId/push
POST   /api/v1/admin/workflow/:entityType/:entityId/proofs
GET    /api/v1/admin/workflow/:entityType/:entityId/lock
POST   /api/v1/admin/workflow/:entityType/:entityId/lock
DELETE /api/v1/admin/workflow/:entityType/:entityId/lock

GET    /api/v1/admin/support/tickets
GET    /api/v1/admin/support/tickets/:id
PATCH  /api/v1/admin/support/tickets/:id
POST   /api/v1/admin/support/tickets/:id/responses
POST   /api/v1/admin/support/tickets/:id/read
POST   /api/v1/admin/support/tickets/:id/close
POST   /api/v1/admin/support/tickets/:id/reopen
GET    /api/v1/admin/feedback
PATCH  /api/v1/admin/feedback/:id
GET    /api/v1/admin/audit-logs

GET    /api/v1/admin/reports/sales/analytics
GET    /api/v1/admin/reports/acquisition/analytics
GET    /api/v1/admin/reports/revenue/analytics
GET    /api/v1/admin/reports/exports
POST   /api/v1/admin/reports/export
GET    /api/v1/admin/reports/exports/:id/download-url
GET    /api/v1/admin/reports/exports/:id/download        (public, signed token)
```

> ⚠️ **Generic timeline route** `GET /admin/:entityType/:entityId/timeline` is a wildcard at the `/admin` level — register it **after** all specific `/admin/*` routes, and constrain `:entityType` to the enum above.
