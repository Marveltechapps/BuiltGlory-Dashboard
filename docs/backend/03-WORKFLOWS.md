# 03 — Workflows & Business Logic

How the dashboard drives each record through its lifecycle, which API calls fire at each step, and what the **backend must enforce or compute**. Sources: `src/modules/**/pages/*DetailPage.tsx`, `src/components/detail/*`, `src/hooks/*`.

Legend: 🖥 = logic currently done in the UI · 🛠 = backend should do / enforce.

---

## 0. Big picture

```
Customer app ──► Sell Request ──review──► Acquisition pipeline ──acquired──► Property (listed on app)
                                                                              │
Customer app ──► Buy Enquiry ──convert──► Sales pipeline ──closed──► Property status = sold
                 Visits / Callbacks / Interior leads / Chats feed the sales side
```

Cross-cutting on every detail page:
1. **Edit lock** — on open: `GET …/lock`; if free → `POST …/lock {ttlSeconds:1800}`; on leave → `DELETE …/lock`. If another admin holds it, a yellow "Another admin may be viewing this record (name)" banner shows. Locks are advisory (no write blocking). 🛠 Expire via TTL; `isMine` computed from the token's admin.
2. **Notes / Call log / Sent messages / Activity** — all from `GET /admin/workflow/:type/:id/logs` filtered by `channel`, and `GET /admin/:type/:id/timeline`.
   - Note → `POST logs { channel:'note', direction:'internal', summary: text[0..300], body: text }`
   - Call → `POST logs { channel:'call', direction:'outbound', summary:'Call logged: <outcome>', outcome, body, durationMinutes, occurredAt }` — outcomes: `Interested | Not Interested | Callback Later | No Answer | Wrong Number`.
   - Delete note → `DELETE /admin/workflow/logs/:logId`.
3. **Compose (WhatsApp / SMS / Email)**:
   - WhatsApp/SMS: UI opens `wa.me` / `sms:` link on the admin's device, then logs `POST logs { channel:'whatsapp'|'message', direction:'outbound', summary, body, outcome: recipient }`. 🛠 Backend does **not** send WhatsApp here.
   - Email (with a record context): `POST /admin/workflow/:type/:id/email { to, subject, body, summary }` — 🛠 **backend sends the email** and creates the `email` log.
4. **Timeline** 🛠 should merge: stage changes (`stageHistory`), field updates (audit), and workflow logs, newest first.
5. **Audit** 🛠 write an audit log on every admin mutation (`action`, `resourceType`, `resourceId`, `before`, `after`, `ipAddress`, `userAgent`, `actorId`).
6. **Stage moves** — every pipeline stage change calls `PATCH …/stage { stage, ...extra }`. 🛠 append `stageHistory {from,to,changedAt,notes}`, update `lastActivityAt`, reset days-in-stage.

---

## 1. Buy Enquiry

Statuses: `new → responded → visit_scheduled → negotiating → closed`.

| Action (UI) | API |
| --- | --- |
| Change status | `PATCH /buy-enquiries/:id { status }` |
| Assign | `PATCH … { assignedTo }` |
| "Create Visit" (interest = schedule_visit) | `PATCH … { status:'visit_scheduled', assignedTo? }` + `POST workflow logs { channel:'note', summary:'Visit agreed for <when> (<type>)', body:'Meeting link: …' }` |
| "Start Negotiation" (interest = price_negotiation) | `PATCH … { status:'negotiating' }` → navigates to Chat tab |
| "Convert to Deal" | if `dealId` exists → open deal; else `POST /buy-enquiries/:id/convert-to-deal` → open `/admin/sales/<newId>` |

🛠 convert-to-deal must: create a SalesDeal (`stage:'active_leads'`, `buyerId`, `propertyId`, snapshots, `sourceEnquiryId`), set `enquiry.dealId`, and be **idempotent** (return the existing deal if already converted).
🛠 Flag `duplicateOf` when the same buyer enquires on the same property again.

---

## 2. Sell Request → Acquisition

Statuses: `draft, new, under_review, approved/accepted, active, negotiating, changes_requested, rejected, paused, sold`.

Admins **cannot edit** seller-submitted fields — only assign and review (UI banner says so).

| Action | API |
| --- | --- |
| Assign | `PATCH /sell-requests/:id { assignedTo }` |
| Start review / approve / pause / etc. | `PATCH …/review { decision, notes?, reason?, pauseReason? }` |
| Reject | `PATCH …/review { decision:'rejected', rejectionReason, reason }` |
| Request changes | compose WhatsApp to seller → on send `PATCH …/review { decision:'changes_requested' }` (optionally `changeRequests[]`) |
| Mark sold | `PATCH …/review { decision:'sold', salePrice, saleDate, saleBuyerName? }` |
| Create acquisition | `POST …/create-acquisition` → navigates to acquisition |

🛠 create-acquisition: create Acquisition with `stage:'pending_review'`, `createdFrom:'sell_request'`, `sellRequestId`, `sellerId`, `sellerSnapshot` (incl. `kycStatus`, `userType`), `propertyTitle/Type/Location/City`, `askingPrice`, `propertyDetails` (address, specifications, media), `photos`; set `sellRequest.acquisitionId`; idempotent.
🛠 compute `completenessPercent` (7 equal checks: specifications, photos, askingPrice>0, ≥1 document, description, address(city+pincode+locality/street), amenities).

---

## 3. Acquisition pipeline

```
pending_review → site_inspection → valuation → negotiation → token_to_seller → documentation → seller_payout → acquired
        └──────────── any active stage ──► rejected  (Move back → pending_review)
        └──────────── any active stage ──► on_hold   (Resume → chosen stage, default = prevStage)
```
Header actions everywhere: Call / WhatsApp / Email seller, **Assign** (`PATCH { assignedTo }`, only available sales-team members), **Priority** (`PATCH { priority: urgent|high|normal }`). "⚠️ Stalled" shown when `daysInStage > 14`.

### 3.1 pending_review
- Review checklist (5 items) → `PATCH /acquisitions/:id { documentation: { ...doc, workflow: { reviewChecklist } } }`.
- **Accept → schedule inspection**: modal (inspector, date ≥ today, time slot, notes) → `PATCH …/stage { stage:'site_inspection', valuation: { ...valuation, siteInspection: { inspector, date, time, notes } } }`.
- Reject (see 3.10).

### 3.2 site_inspection
- Reschedule → `PATCH …/valuation { valuation: { ..., siteInspection: { ...ins, date, time } } }`.
- Cancel → `PATCH …/stage { stage:'pending_review', valuation: { ..., siteInspection: null } }`.
- Mark complete → `…/valuation` with `siteInspection.completed=true, completedAt`.
- Save report (condition, structural Y/N, repairCost if Y, photos count > 0, recommendation, notes) → `…/valuation` with `siteInspection.report`.
- Move to valuation → `…/stage { stage:'valuation' }` (🖥 requires report; confirm if recommendation contains "Reject").

### 3.3 valuation
- Save valuation (valuedBy, valuationDate ≤ today, marketValue, offer, comparables, notes) → `PATCH …/valuation { valuation: {..., valuedBy, valuationDate, marketValue, builtgloryValuation, comparables, notes}, builtgloryOffer }`.
- 🖥 Price gap % = (asking − offer)/asking; > 25% warns "likely to reject".
- Start negotiation → `…/stage { stage:'negotiation', negotiation: { offers: [{ amount: offer, by:'Builtglory', status:'active', notes:'Initial offer', offeredAt }] } }`.

### 3.4 negotiation
- New offer → all existing `active` offers become `countered`, append new → `PATCH …/negotiation { negotiation: { offers }, builtgloryOffer? }` (`builtgloryOffer` updated when by = Builtglory).
- Deadline → saved in `documentation.workflow.negotiationDeadline`.
- **Confirm deal** (final price; if < 80% of asking requires "management approval" checkbox 🖥) → `…/stage { stage:'token_to_seller', agreedPrice, negotiation: { ..., agreedPrice } }`.

### 3.5 token_to_seller
- Requires `agreedPrice` (else "Back to Negotiation").
- Suggested token = 5% of agreed, rounded to ₹10,000.
- Record token → `PATCH …/token { token: { paid:true, amount, payment: PaymentRecord } }`. Undo → `{ token: { paid:false, amount:0 } }`.
- Receipt printed client-side (no API).
- Move to documentation (🖥 requires token paid).

### 3.6 documentation (seller legal)
All saved via root `PATCH /acquisitions/:id { documentation: { ...doc, <patch> } }`:
- Ownership type (freehold / leasehold + lease details; warns if < 10 yrs remaining).
- **Legal document checklist** — groups in `SELLER_LEGAL` (Registration, Revenue, Approvals, Tax & Utility, Family & Succession, Loan & Encumbrance, Court, Govt Acquisition, CRZ, Environmental, Water body, Hill). Per doc `docs[name] = { status, url, fileName, rejectionReason, updatedAt }`. Uploads go through `POST /workflow/acquisition/:id/proofs` (multipart `file`) and the returned `attachments[0].url` is stored.
- Advocate (name, bar `^[A-Z]{2,4}/\d+/\d{4}$`, phone, email, firm, fee), advocate checklist (8 items), issues[], certificate upload (proof endpoint), `legalVerifiedAt` (🖥 needs certificate).
- Move to seller_payout (🖥 requires `legalVerifiedAt`; confirm if required docs not all verified).

### 3.7 seller_payout
- Balance = agreedPrice − token.
- Record payout (amount, method, ref, date ≤ today, proof checkbox) → `PATCH …/payout { payout: { completed:true, amount, method, notes:'Ref … · date' } }`. Mismatch vs balance warns.
- Pre-acquisition checklist (5 items) in `documentation.workflow.preAcquisitionChecklist`.
- **Mark as Acquired** (🖥 requires payout) → `…/stage { stage:'acquired', finalPurchasePrice: agreedPrice }`.

### 3.8 acquired → list on app
"List Property": `POST /acquisitions/:id/convert-to-property` → `PATCH /properties/:newId { title, price, isFeatured, isUpcoming }` → `PATCH /acquisitions/:id { documentation.workflow.listedPropertyId }`.
🛠 convert-to-property: create Property with `source:'acquired'`, `acquisitionId`, copy title/type/address/specs/media/photos, status `available` (or `draft`), set `acquisition.propertyId`; idempotent.

### 3.9 on_hold
`…/stage { stage:'on_hold', onHoldReason, notes }` + `documentation.workflow.prevStage`. Resume → `…/stage { stage:<chosen>, onHoldReason:'' }`.

### 3.10 rejected
`…/stage { stage:'rejected', rejectionReason, reason, notes }` + `documentation.workflow { rejectedStage, sellerNotified }`; if "notify seller": `POST /workflow/acquisition/:id/push { userId: sellerId, audience:'seller', notificationId:'N-02', template:{ title:'Listing update', body } }`. Reasons: Price too high, Poor condition, Location not suitable, Incomplete info, Duplicate, Other. Reconsider → `…/stage { stage:'pending_review', rejectionReason:'' }`.

---

## 4. Sales pipeline

```
active_leads → site_visits → negotiation → token_payment → full_payment ┐
                                                      └──→ stage_payment ┴→ interior_design → documentation → closed
any → lost  → (re_engagement → active_leads)  |  lost → "Start new deal" (POST /sales/deals)
```
Header: Assign (`PATCH { assignedTo }`), Priority (`PATCH { priority }`), manual "Move Stage" to any non-terminal stage (`…/stage`).
"Mark as Lost" modal anywhere: `PATCH …/lost { lostReason, notes }` + `PATCH /sales/deals/:id { documentation.workflow { lostAtStage, lostAt, lostNotes } }`. Reasons: Budget constraints, Bought elsewhere, Loan not approved, Not interested, Price disagreement, Other.

### 4.1 active_leads
- Stale banners: > 5 days "follow up", > 14 days "Stale lead".
- Qualification (intent, budget min/max, timeline, financing, notes) → `documentation.workflow.qualification`.
- Schedule site visit → creates a visit (via visit flow) then `…/stage { stage:'site_visits' }`.
- Not interested → `…/lost { lostReason:'Not interested' }`.

### 4.2 site_visits
- UI loads all visits (`GET /visits`) and picks the latest for the same `buyerId` + `propertyId`. 🛠 Recommended: support `?buyerId=&propertyId=` filter on `/visits`.
- Pre-visit checklist (4) → `workflow.preVisit`.
- Mark visit completed/missed/cancelled → `PATCH /visits/:visitId/status { status, cancelReason?, reason? }`.
- Post-visit feedback → `POST /visits/:visitId/feedback { feedback: { buyerInterest: very_interested|interested|needs_time|not_interested, nextAction: move_to_negotiation|schedule_another_visit|follow_up|mark_lost, notes } }`.
- Follow-up reminder → `workflow.followUp`.

### 4.3 negotiation
- Offers stored in `documentation.workflow.offers` (via `PATCH /sales/deals/:id { documentation }`); a Buyer offer also calls `PATCH …/offer { offeredPrice }`.
- Buyer counter-offer older than 72h → "expired" banner.
- Escalate → `POST workflow logs { channel:'note', summary:'Negotiation escalated to Sales Manager' }`.
- **Confirm deal** (discount > 10% off listed needs management approval 🖥) → `PATCH …/offer { agreedPrice }` then `PATCH …/stage { stage:'token_payment', agreedPrice }`.

### 4.4 token_payment
- Buyer app submissions: `GET /payments?dealId=<id>` (type `token`). Verify → `PATCH /payments/:pid/verify { decision:'paid' }` + `PATCH …/token-payment { tokenAmount, tokenPaid:true }`. Reject → `{ decision:'rejected', notes }`.
  🛠 Recommended: when a token payment is verified `paid`, backend auto-updates the deal's `financials.tokenPaid/tokenAmount/tokenPayment` and `totalPaid`.
- Record office payment → `PATCH …/token-payment { tokenAmount, tokenPaid: !partial, tokenPayment: { ...PaymentRecord, notes } }`. Undo → `{ tokenPaid:false, tokenPayment:null }`.
- Suggested token = 5% of agreed; > 20% warns.
- Choose payment type → `PATCH …/payment-plan { paymentType:'full'|'stage' }`.
- Next (🖥 requires `paymentType` and `tokenPaid`) → `…/stage { stage:'full_payment'|'stage_payment' }`.

### 4.5 full_payment
- Charges (default Stamp Duty 5.6%, Registration 1% of agreed) grouped `prop | reg | other` → `PATCH …/payment-plan { paymentType:'full', fullPayment: { charges } }`.
- Total = agreed + all charges; balance = total − totalPaid.
- Record full payment (proof required) → `…/payment-plan { paymentType:'full', fullPayment: { charges, payment }, totalPaid: totalPaid + amount }`.
- Move to documentation (🖥 requires payment).

### 4.6 stage_payment
- Create plan: 2–5 milestones `{ id:'MS-n', name, dueDate, amount, status:'pending' }`, sum must equal agreed − token 🖥 → `…/payment-plan { paymentType:'stage', stagePayment: { milestones, planStatus:'sent' } }`.
- Plan response chips → `planStatus: accepted|negotiating|declined`.
- Milestone `proof_pending` (buyer uploaded proof in app — 🛠 app/backend sets `status:'proof_pending'`, `proofUrl`, `proofSubmittedAt`): Verify → milestone `{ status:'paid', paidAt }` then `{ totalPaid: totalPaid + amount }`; Reject → `{ status:'pending', proofRejectedReason, proofSubmittedAt:null }`.
- Overdue = not paid and `dueDate < today` (🖥 computed; 🛠 may also set it).
- Record stage payment → milestone `{ status:'paid', paidAt, payment }` + `totalPaid`.

> ⚠️ The UI sends `totalPaid` computed client-side. 🛠 Prefer recomputing `totalPaid` server-side from token + payments + paid milestones to avoid race conditions.

### 4.7 interior_design
All via `…/payment-plan { interiorDesign: {...} }`: assign designer (from `GET /admin/designers`), consultation date, quote `{ pkg, amount, weeks, inclusions, terms, status }`, status transitions (sent / accepted / negotiating / declined), payments[]. Skip → `interiorDesign.skipped=true` → documentation.

### 4.8 documentation (buyer legal)
- Buyer legal checklist (`BUYER_LEGAL`: Agreement for Sale, Title Deed, Registered Sale Deed, Khata transfer, Stamp duty receipt, TDS 16B, Electricity transfer, Possession letter) stored in `documentation.docs` (uploads via `/workflow/sales_deal/:id/proofs`).
- Registration `{ date, office, sub }`, handover checklist (4) in `documentation.workflow`.
- **Close deal** → `PATCH …/close {}` then `PATCH /properties/:propertyId/status { status:'sold', reason:'Deal closed' }` and `PATCH /properties/:propertyId { isFeatured:false }`.
  🛠 Recommended: `/close` itself marks the property `sold` (+`soldAt`, unfeature) atomically.

### 4.9 lost / re_engagement
- Lost: analysis (`workflow.analysis`), token refund request (`workflow.refund`), alternatives (`GET /properties?status=available&limit=20`), **Re-engage** → `…/stage { stage:'re_engagement', reengagement: { lastContactAt: now, attempts: 0 } }`, **Start new deal** → `POST /sales/deals { buyerId, propertyId, assignedTo? }`, archive → `workflow.archived=true`.
- Re-engagement: recommendations `GET …/recommendations?limit=6` (🛠 score similar available properties by type/locality/price band; return `score`, `reason`), follow-up date (`PATCH { reengagement: { followUpAt } }`), outreach log (`workflow.outreach` + `reengagement.attempts+1`, `lastContactAt`), move back → `active_leads`, close → `…/lost`.

---

## 5. Visits

Statuses: `scheduled, confirmed, completed, cancelled, missed, rescheduled`.
- Confirm / complete / miss / cancel → `PATCH /visits/:id/status { status, cancelReason?, reason? }`.
- Reschedule → `{ status:'rescheduled', visitDate, visitTime (24h), reason }` — 🛠 push to `rescheduleHistory`.
- Virtual: `meetingLink`, `virtualPlatform`, `virtualRecordingUrl`, `callDuration`, `callNotes`.
- NRI buyers: `nriChecklist` map + `nriAssistanceNotes`.
- Feedback → `POST /visits/:id/feedback`; call → `POST /visits/:id/call-logs`.
- Time slots offered: 09:00 AM … 06:00 PM (UI converts to 24h).
- 🛠 Notify buyer (push/WhatsApp) on schedule/reschedule/cancel; set `reminderSent`; produce `visit_scheduled` notification.

## 6. Callbacks
Statuses: `pending, called, resolved, missed, rescheduled, overdue`.
- Log attempt → `POST …/attempts { outcome, notes, assignedTo? }` — 🛠 append attempt, increment `attemptsCount`, set status `called` (or `missed` on no_answer etc.).
- Resolve → `PATCH …/resolve { resolutionNotes }` → `resolved`.
- Reschedule → `PATCH …/reschedule { preferredTime, reason, notes? }` → `rescheduled`.
- 🛠 `slaDeadline` from settings; scheduler flips to `overdue` and emits `callback_overdue` notification; feeds `kpis.overdueCallbacks`.

## 7. Interior leads
`new → contacted → quote_sent → accepted | negotiating | declined → completed`.
- Send quote → `PATCH { status:'quote_sent', quote: { amount, packageName, timeline, inclusions[], validUntil } }`.
- Accept → `{ status:'accepted', assignedDesigner, customerAcceptedAt }`.
- Complete → `{ status:'completed', completionNote }`.
- 🛠 `slaDeadline = createdAt + sla.interiorHours`; feeds `slaQueues.interiorLeads`.

## 8. Negotiation chat
- List/detail threads; admin sends `text` or `offer` (`offerAmount`) messages; "Deal agreed" sends `{ type:'deal_agreed', text, offerAmount }`. 🛠 deliver message to buyer app (push/socket); on `deal_agreed` set thread status + `negotiation.agreedPrice`, and ideally create/link a SalesDeal (`dealId`).

---

## 9. Properties

- Tabs: All / Featured / Upcoming / Deleted (client-side filters on a list loaded with `includeDeleted=true`).
- Create (Add Property form) → `POST /properties` with `status` (`draft` if "Save as draft", else available/under_construction/reserved), `isVisibleOnApp = !draft`, address, specs, amenities, media URLs.
- Edit → `PATCH /properties/:id` (send full `media` object — it replaces).
- Status changes → `PATCH …/status`. Quick actions:
  - Publish draft: `status:'available'` + `isVisibleOnApp:true`
  - Mark sold: `status:'sold'` + `isFeatured:false`
  - Launch upcoming: `isUpcoming:false, isVisibleOnApp:true` + `status:'available'`
- Soft delete / restore / permanent delete.
- Media upload → `POST …/media` multipart `files` (≤20) + `documentType`.
- **Price drop**: after lowering price, UI pushes to each `savedByUsers` → `POST /notifications/push { userId, audience:'buyer', notificationType:'price_drop', title, message, propertyId, entityType:'property', entityId }`. 🛠 Could be done server-side on price decrease.
- Rules 🖥: Featured & Upcoming cannot both be true; title/type/price required.
- **Bulk upload**: download template (`GET bulk-template?mode=empty|valued`) → user fills XLSX/CSV → `POST bulk-upload` (multipart `file`) → response shows `valid`, accepted/rejected counts, row errors, created `job`. Import history `GET import-jobs`; undo `POST /import-jobs/:id/undo` (🛠 soft-deletes properties created by that job, returns `revertedCount`).
- Templates tab (mode `valued`) lets admins edit rows inline → per row `PATCH /properties/:id { title, type, price, address }` + `PATCH …/status`, or `POST /properties` for new rows.

## 10. Users
- List tabs All/Buyers/Sellers; block/unblock (`/block { isBlocked, blockedReason }`), assign RM (`/assign`), edit profile, FEMA check for NRI/PIO (`/fema`), export user data (`/export` → JSON download).
- 🛠 compute `totalEnquiries/Visits/Deals/Listings`; KYC counts feed `kpis.pendingKycUsers`.

## 11. Support tickets & feedback
- Ticket detail auto-marks read (`POST …/read`).
- Reply → `POST …/responses { message, status:'in_progress' if currently open }`.
- Change status/priority/assignee/escalate → `PATCH …`.
- Close / Reopen → `POST …/close` / `…/reopen`.
- UI banners: urgent with no reply > 24h; any no reply > 48h. 🛠 notify customer on admin reply.
- Feedback: `PATCH /feedback/:id { status: reviewed|archived|new }`.

## 12. Tools
- **App content** (home layout, banners, onboarding slides, property-type visibility, featured/upcoming curation, force update, terms, privacy, about) — each is a CMS record found by `slug` in `GET /admin/content` (all sections). Save = `PATCH /content/:id` if the slug exists else `POST /content` with `{ slug, section, title, excerpt, category, metadata, body: JSON.stringify(metadata), status:'published' }`. Reorder of content items → `PATCH /content/reorder`. Featured/upcoming toggles on properties → `PATCH /properties/:id` (+ `/status`).
- **Locations / zones / boost orders** → `tools-operational-config` metadata.
- **Pricing** → settings `tools.boostPlans / interiorPackages / coupons` (`PATCH /settings { tools: {...} }`); designers managed via `/admins/invite { role:'designer', specialization, assignedArea, isAvailable }`, `/admins/:id { isAvailable }`, `DELETE /admins/:id`.
- **Master sheet** — read-only aggregate of properties/acquisitions (uses list endpoints).
- **Message templates** — CRUD; duplicate = create with "(copy)".
- **Bulk message** → `POST /bulk-messages { audience, channel, title?, message, recipients?, templateId?, scheduledAt? }`; 🛠 resolve audience → recipients, queue delivery, track `status` (`queued → sent/delivered/failed`), `queuedCount`. History also from `GET /communication-logs?direction=outbound&channel=whatsapp&channel=email&channel=message`.
- **Push** → `POST /notifications/push` (one user per call); history = notifications where `channel='push'`; retry failed → `POST /notifications/:id/retry`.

## 13. Admin settings & access control
- General settings → `PATCH /settings` (deep merge). SLA hours drive overview SLA queues and auto-escalation (`sla.autoEscalate`, `escalateToAdminId`).
- Access control: list admins; add admin = `POST /admins/invite { name, email, phone?, photoUrl?, role, department?, permissions: DEFAULT_ROLE_PERMISSIONS[role], status:'active' }` then `POST /admins/:id/reset-password { password }`; edit (`PATCH /admins/:id { name, role }`), permissions matrix (`PATCH /admins/:id/permissions`), suspend/reactivate (`POST /admins/:id/suspend { suspended }`), remove. 🛠 suspended admins must not be able to log in / refresh; email unique.
- Sales team CRUD (`/sales-team`) with availability toggle; only `isAvailable` members appear in "Assign To" pickers.
- Device sessions: list / revoke one / revoke others.
- Audit trail: search + list.

## 14. Reports
- Sales / Acquisition / Revenue analytics filtered by `from`, `to` (ISO dates), `propertyType`. 🛠 Aggregations:
  - Sales: closed deals count, revenue (sum agreedPrice of closed), avg deal value, conversion (closed / total deals %), open pipeline count & value, monthly closed (deals, revenue), monthly activity, revenue by property type, pipeline by stage, top properties by views/enquiries/visits/compareCount.
  - Acquisition: acquired count, cost (sum finalPurchasePrice), avg cost, active pipeline count, incoming sell requests, counts per stage, value by type.
  - Revenue: revenue, cost, profit = revenue − cost, margin %, monthly revenue vs cost, profit trend, pending payments (open deals with balance: amount, paid, balance).
- Export: queue job → background worker builds CSV/XLSX/PDF → status `ready` with `fileName`, `rowCount`, `expiresAt`; `download-url` returns a short-lived signed URL that works without the bearer header. Optionally email to `deliveryEmail`.

---

## 15. Background jobs the backend needs (implied by the UI)

| Job | Purpose |
| --- | --- |
| SLA monitor | compute SLA status for enquiries / stage payments / interior leads; flip callbacks to `overdue`; auto-escalate if enabled; produce notifications |
| Milestone overdue | mark stage-payment milestones overdue past `dueDate` |
| Edit-lock expiry | TTL cleanup |
| Export worker | generate report files |
| Bulk message / push dispatcher | deliver queued messages, update status, allow retry |
| Stats for overview | `kpis`, `navBadges`, charts (cache OK — UI staleTime is 15 s) |
