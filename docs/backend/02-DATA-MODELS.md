# 02 — Data Models

These are the **raw fields the frontend reads** from each record (from the `mapXxx()` functions in `src/services/**`). Use them as the Mongo schema / response shape. `→` shows the normalised name the UI uses; `||` shows accepted alternates (first one is preferred — use it).

Conventions:
- `ref<X>` = ObjectId of X **or** a populated object (`{ _id, name, email, phone, ... }`). Populating `assignedTo`, `buyerId`, `sellerId`, `userId`, `actorId`, `responderId` lets the UI show names without extra calls.
- `*Snapshot` objects are denormalised copies captured at creation; the UI prefers them over the populated ref.
- All records: `_id`, `referenceId`, `createdAt`, `updatedAt`.

---

## Buy Enquiry (`buy_enquiry`)
| Field | Type | Notes |
| --- | --- | --- |
| `buyerId` | ref User | |
| `buyerSnapshot` | `{ name, phone, email, userType }` | `userType`: `resident\|nri\|pio` |
| `propertyId` | ref Property | |
| `propertySnapshot` | `{ title, type, price, location }` | |
| `enquiryTypes` | string[] | |
| `interestType` | `schedule_visit \| price_negotiation \| more_details` | default `more_details` |
| `preferredContact` | `phone \| whatsapp \| email` | |
| `preferredVisitTime` | string | e.g. `tomorrow_morning`, `this_weekend_afternoon`, `custom` |
| `preferredVisitDate` | date | |
| `preferredVisitTimeSlot` | string | e.g. `10:00 AM` |
| `additionalMessage` | string | |
| `status` | `new \| responded \| visit_scheduled \| negotiating \| closed` | |
| `assignedTo` | ref Admin | |
| `duplicateOf` | ref BuyEnquiry | duplicate detection (same buyer + property) |
| `dealId` \|\| `salesDealId` \|\| `convertedDealId` | ref SalesDeal | set after convert-to-deal |
| `source` | string | default `app` |
| `notes` | string | |
| `submittedAt` \|\| `createdAt` | date | |

## Sell Request (`sell_request`)
| Field | Type | Notes |
| --- | --- | --- |
| `sellerId`, `sellerSnapshot` | ref User / `{ name, phone, email, kycStatus, userType }` | |
| `propertyTitle`, `propertyType` | string | |
| `askingPrice` | number | |
| `negotiable`, `loanOnProperty`, `isDraft` | boolean | `isDraft=true` → shown as status `draft` |
| `address` | `{ street, locality, city, state, pincode, landmark }` | |
| `ownershipType`, `possessionStatus`, `description` | string | |
| `amenities` | string[] | |
| `specifications` | `Record<string, string\|number>` | e.g. `{ bedrooms, plotArea, facing }` |
| `photos` | string[] (URLs) | fallback: image URLs in `documents[]` |
| `documents` | `[{ name, status: uploaded\|rejected\|missing, fileUrl }]` | |
| `photosCount`, `documentsCount` | number | optional |
| `completenessPercent` \|\| `completeness` | number 0–100 | if absent UI computes from 7 checks (specs, photos, price, docs, description, address, amenities) — **recommended: backend computes** |
| `status` | `draft \| new \| under_review \| approved \| accepted \| active \| negotiating \| changes_requested \| rejected \| paused \| sold` | |
| `assignedTo` | ref Admin | |
| `rejectionReason`, `pauseReason` | string | |
| `changeRequests` | string[] | |
| `acquisitionId` | ref Acquisition | set by create-acquisition |
| `duplicateOf` | ref SellRequest | |
| `metrics` | `{ views, enquiryCount, visitCount, saveCount }` | |
| `sale` | `{ salePrice, saleDate, buyerName }` | when `sold` |
| `submittedAt` | date | |

## Visit (`visit`)
| Field | Type | Notes |
| --- | --- | --- |
| `buyerId`, `buyerSnapshot` | ref / `{ name, phone, email, userType }` | |
| `propertyId`, `propertySnapshot` | ref / `{ title, type, price, location \|\| address, image }` | |
| `visitDate` | `YYYY-MM-DD` or date | |
| `visitTime` | `HH:mm` (24h) | default `10:00` |
| `visitType` | `physical \| virtual` | |
| `status` | `scheduled \| confirmed \| completed \| cancelled \| missed \| rescheduled` | |
| `meetingLink`, `virtualPlatform` (`zoom\|google_meet\|teams\|whatsapp_video`), `virtualRecordingUrl` | string | |
| `callDuration` (number), `callNotes` | | |
| `assignedAdmin` | ref Admin | **note: not `assignedTo`** |
| `feedback` | `{ buyerInterest, notes, nextAction, completedAt }` | |
| `callLogs` | `[{ _id, outcome, notes, duration, calledAt }]` | |
| `notes` \|\| `visitNotes` | `[{ _id, text, createdAt }]` | |
| `nriChecklist` | `Record<string, boolean>` | |
| `nriAssistanceNotes`, `followUpAction`, `cancelReason` | string | |
| `documentsShared` | string[] | |
| `followUpDate` | date | |
| `rescheduleHistory` | `[{ previousDate, previousTime, newDate, newTime, reason, changedAt }]` | |
| `reminderSent` | boolean | |

## Callback (`callback`)
| Field | Type | Notes |
| --- | --- | --- |
| `userId`, `userSnapshot` | ref / `{ name, phone, email }` | |
| `userType` | `buyer \| seller \| …` | |
| `source` (default `help_support`), `sourceScreen` | string | |
| `category` | `property_inquiry \| pricing \| technical_issue \| complaint \| general \| stage_payment \| interior` | |
| `propertyId`, `propertySnapshot{title}` | | optional |
| `reason`, `preferredTime`, `bestTimePreference` (`morning\|afternoon\|evening`) | string | |
| `status` | `pending \| called \| resolved \| missed \| rescheduled \| overdue` | backend should flip to `overdue` past `slaDeadline` |
| `attempts` | `[{ _id, outcome, notes, attemptedAt }]` | `outcome`: `answered\|no_answer\|busy\|wrong_number\|callback_later` |
| `attemptsCount` | number | |
| `resolutionNotes` | string | |
| `assignedTo` | ref Admin | |
| `slaDeadline` | date | |

## Interior Lead (`interior_lead`)
| Field | Type | Notes |
| --- | --- | --- |
| `buyerId`, `buyerSnapshot`, `propertyId`, `propertySnapshot{title,location}` | | |
| `userType` | string | |
| `selectedRooms` | string[] | |
| `designStyle` | `modern \| contemporary \| minimalist \| classic` | |
| `budgetRange` | `budget \| standard \| premium \| luxury` | |
| `notes` | string | |
| `status` | `new \| contacted \| quote_sent \| accepted \| negotiating \| declined \| completed` | |
| `assignedDesigner` | ref Admin (designer) | |
| `slaDeadline` | date | |
| `quote` | `{ amount \|\| totalPrice, packageName, timeline, inclusions[], validUntil }` | |
| `customerAcceptedAt`, `completionNote` | | |

## Chat Thread (negotiation)
| Field | Type | Notes |
| --- | --- | --- |
| `buyerId`, `buyerSnapshot{name,phone}`, `propertyId`, `propertySnapshot{title,price}` | | |
| `status` | `active \| deal_agreed \| lost \| inactive` | |
| `negotiation` | `{ listedPrice, agreedPrice, deadline }` | |
| `dealId` \|\| `salesDealId` | ref SalesDeal | |
| `lastMessageAt` | date | |
| `messages` | `[{ _id, sender \|\| senderType ('buyer'\|'admin'), type ('text'\|'offer'\|'counter_offer'\|'deal_agreed'), text \|\| offerMessage, offerAmount \|\| amount, offerStatus \|\| status, createdAt }]` | `counter_offer` is displayed as `offer` |

## Acquisition (`acquisition`)
| Field | Type | Notes |
| --- | --- | --- |
| `stage` | `pending_review → site_inspection → valuation → negotiation → token_to_seller → documentation → seller_payout → acquired`; side states `rejected`, `on_hold` | |
| `priority` | `normal \| high \| urgent` | |
| `createdFrom` | `sell_request \| manual` | |
| `sellRequestId` | ref SellRequest | |
| `sellerId`, `sellerSnapshot` | `{ name, phone, email, kycStatus, userType }` | |
| `propertyTitle`, `propertyType`, `propertyLocation`, `propertyCity` | string | |
| `propertyDetails` | `{ address{locality,city}, specifications{}, media{ videoUrl, droneVideoUrl, tourUrl3D, floorPlanUrl } }` | copied from sell request |
| `askingPrice`, `builtgloryOffer`, `agreedPrice`, `finalPurchasePrice` | number | |
| `assignedTo` | ref Admin | |
| `daysInStage` | number | optional; UI computes from `stageHistory` |
| `lastActivityAt` | date | |
| `photos` \|\| `media.photos` | string[] | |
| `rejectionReason`, `onHoldReason`, `notes` | string | |
| `valuation` | free-form object — see below | |
| `negotiation` | `{ offers: [{ amount, by: 'Builtglory'\|'Seller', status: active\|accepted\|rejected\|countered, notes, offeredAt }], agreedPrice }` | |
| `token` | `{ paid: boolean, amount, payment: PaymentRecord }` | |
| `documentation` | free-form — see below | |
| `payout` | `{ completed: boolean, amount, method, notes }` | |
| `propertyId` \|\| `convertedPropertyId` | ref Property | set by convert-to-property |
| `stageHistory` | `[{ from, to \|\| stage, changedAt \|\| enteredAt, notes }]` | **append on every stage change** |

`valuation`:
```ts
{ siteInspection: { inspector, date: 'YYYY-MM-DD', time: '11:00 AM', notes, completed, completedAt,
                    report: { condition: 'Excellent'|'Good'|'Fair'|'Poor', structural: 'Yes'|'No', repairCost, photos: number,
                              recommendation: 'Proceed ✅'|'Proceed with Caution ⚠️'|'Recommend Reject ❌', notes } | null } | null,
  valuedBy, valuationDate, marketValue, builtgloryValuation, comparables, notes }
```

`documentation` (acquisition, seller side):
```ts
{
  ownership: { type: 'freehold'|'leasehold', period, start, lessor, lessorType, noc, remaining },
  docs: { [docName]: { status: 'missing'|'requested'|'pending'|'verified'|'rejected'|'sent', url, fileName, rejectionReason, updatedAt } },
  docsRequired: { [docName]: boolean },
  customDocs: { [groupName]: string[] },
  advocate: { name, bar: 'KAR/1234/2010', phone, email, firm, fee } | null,
  advocateChecklist: { [label]: boolean },
  issues: string[],
  certificate: { url, fileName },
  legalVerifiedAt: ISO | null,
  workflow: {                       // UI-only bookkeeping, store as-is
    reviewChecklist: { [label]: boolean },
    preAcquisitionChecklist: { [label]: boolean },
    negotiationDeadline: 'YYYY-MM-DD' | null,
    rejectedStage, sellerNotified: boolean, prevStage, listedPropertyId
  }
}
```

## Sales Deal (`sales_deal`)
| Field | Type | Notes |
| --- | --- | --- |
| `stage` | `active_leads → site_visits → negotiation → token_payment → (full_payment \| stage_payment) → interior_design → documentation → closed`; side: `lost`, `re_engagement` | |
| `priority` | `normal \| high \| urgent` | |
| `buyerId`, `buyerSnapshot` | `{ name \|\| fullName, phone \|\| mobile, email, userType }` | |
| `propertyId`, `propertySnapshot` | `{ title, type, location, price, photos[] \|\| image }` | |
| `financials` | see below | UI also accepts these at top level |
| `documentation` | free-form (buyer legal docs + `workflow`) | |
| `assignedTo` | ref Admin | |
| `sourceEnquiryId` | ref BuyEnquiry | |
| `lostReason`, `lostAtStage` \|\| `lostStage` | string | |
| `closedAt` | date | |
| `reengagement` | `{ followUpAt, lastContactAt, attempts }` | |
| `daysInStage`, `lastActivityAt`, `stageHistory` | | same as acquisition |

`financials`:
```ts
{ offeredPrice, agreedPrice, tokenAmount, tokenPaid: boolean,
  tokenPayment: PaymentRecord | null,
  paymentType: 'full' | 'stage' | null,
  totalPaid: number,
  fullPayment: { charges: [{ name, amount, group: 'prop'|'reg'|'other' }], payment: PaymentRecord },
  stagePayment: { planStatus: ''|'sent'|'accepted'|'negotiating'|'declined',
                  milestones: [{ id: 'MS-1', name, dueDate, amount, status: 'pending'|'proof_pending'|'paid'|'overdue',
                                 proofUrl, proofSubmittedAt, proofRejectedReason, paidAt, payment: PaymentRecord }] },
  interiorDesign: { rooms, style, budget, designer, consult: 'YYYY-MM-DD', skipped: boolean,
                    quote: { pkg, amount, weeks, inclusions, terms, status: 'pending'|'sent'|'accepted'|'negotiating'|'declined' },
                    payments: PaymentRecord[] } }
```
(UI also accepts `stagePayment.stages` / `.installments` as the milestone array name, and `name|title|label`, `paidAt|verifiedAt`, `proofSubmittedAt|proofUploadedAt`.)

`documentation.workflow` (sales):
```ts
{ qualification: { intent, min, max, timeline, financing, notes },
  preVisit: { [label]: boolean }, plannedVisit: { date, time, type }, followUp: 'YYYY-MM-DD',
  offers: [{ amount, by: 'Builtglory'|'Buyer', status, notes, offeredAt }], deadline,
  registration: { date, office, sub, done }, handover: { [label]: boolean },
  outreach: [{ channel, notes, at }], rePlan, lostAtStage, lostAt, lostNotes }
```

### PaymentRecord (shared)
```ts
{ amount: number, method: 'neft'|'upi'|'cheque'|'cash', reference: string /* 'Cash' for cash */,
  paymentDate: 'YYYY-MM-DD', proofUrl?, notes? }
```

## Payment (`/admin/payments`) — buyer-submitted payments from the app
`{ _id, referenceId, dealId, propertyId, type: 'token'|…, amount, status: 'created'|'pending'|'paid'|'rejected'|'failed', method, transactionReference, proofUrl, notes, verifiedAt, paidAt, createdAt }`

## Property (`property`)
| Field | Type | Notes |
| --- | --- | --- |
| `title`, `description` | string | |
| `type` | `plot \| apartment \| residential \| commercial \| organic_home \| 3d_printing \| fractional \| ceo_mansion \| holiday_home \| land \| farmhouse \| nri \| interior \| villa` | |
| `status` | `available \| sold \| reserved \| under_construction \| draft` | |
| `source` | `acquired \| manual \| bulk_upload` | |
| `isFeatured`, `isUpcoming`, `isVisibleOnApp`, `isNegotiable`, `isDeleted` | boolean | Featured and Upcoming are mutually exclusive in UI |
| `address` | `{ line1, line2, landmark, locality, city, state, pincode, latitude, longitude }` | |
| `price` | number | |
| `specs` | free-form: `bedrooms, bathrooms, area, plotArea, facing, possession, bookingAmount, …` | |
| `amenities`, `highlights` | string[] | |
| `media` | `{ photos[], coverPhoto, videoUrl, tour3dUrl, floorPlanUrl, droneImageUrl, droneVideoUrl }` | |
| `advantages` | `{ investment[], location[], connectivity[] }` | |
| `nearbyPlaces` | `[{ name, type \|\| category, distance }]` | |
| `savedByUsers` | ref User[] | used for price-drop push |
| `sourceSheet` | string | |
| `metrics` | `{ views, enquiries, visits, savedCount, compareCount }` | |
| `assignedTo`, `acquisitionId` | refs | |
| `deletedAt`, `launchDate`, `possessionDate`, `soldAt` | date | |
| `createdAt` \|\| `addedAt` | date | |

## Import Job
`{ _id, referenceId, fileName, status: 'validated'|'completed'|'reverted'|…, rowsTotal, rowsAccepted, rowsRejected, errors: [{ row, field, message }], importedProperties: [{ _id, referenceId, title, status, isDeleted }], createdAt, completedAt, revertedAt }`

## User (app customer, `user`)
| Field | Type | Notes |
| --- | --- | --- |
| `name`, `phone` \|\| `mobileNumber` \|\| `phoneNormalized`, `email` | | |
| `userType` | `resident \| nri \| pio` | |
| `role` | `buyer \| seller \| both` | |
| `profilePhoto` | URL | |
| `kycStatus` | `not_submitted \| pending \| verified \| rejected` | |
| `kycDocuments` | `[{ _id, name, type, status: missing\|uploaded\|verified\|rejected\|expired, uploadedAt, verifiedAt, rejectionReason, fileUrl }]` | |
| `totalEnquiries`, `totalVisits`, `totalDeals`, `totalListings` | number | computed |
| `city`, `state`, `country` (default `India`) | string | |
| `registeredAt` \|\| `createdAt`, `lastLoginAt` | date | |
| `isActive`, `isBlocked`, `blockedReason` | | |
| `assignedTo` | ref Admin | relationship manager |
| `femaCompliance` | `{ status: not_checked\|compliant\|non_compliant\|under_review, checkedBy: ref Admin, checkedAt, notes }` | NRI/PIO only |

Users tabs: **Buyers** = `role in (buyer, both)`, **Sellers** = `role in (seller, both)` (client-side filter).

## Admin (operator)
`{ _id, name, email, phone, photoUrl, passwordHash (never returned), role, department, permissions[], assignedArea[], specialization[], isAvailable, status: active|suspended|invited, isActive, lastLoginAt, createdAt }`

## Support Ticket (`support_ticket`)
`{ _id, referenceId, userId (populated { name, email, phone \|\| mobileNumber }), userName, phone, email, category, subject, message \|\| description, status: open|in_progress|resolved|closed, priority: low|medium|high|urgent, channel: ticket|live_chat, assignedTo: ref Admin, responses: [{ _id, responderType: admin|customer|system, responderId: ref, message, createdAt }], createdAt, updatedAt }`

## Feedback
`{ _id, referenceId, userId (populated), userName, message, source (default customer_app), sourceScreen, status: new|reviewed|archived, createdAt }`

## Audit Log
`{ _id, action, description, actorId (populated {name,email}), actorType, resourceType, resourceId, before, after, ipAddress, userAgent, createdAt }` — `before/after` may be objects (UI JSON-stringifies). **Every admin mutation should write one.**

## Workflow / Communication Log
`{ _id, entityType, entityId, channel: call|note|message|push|email|whatsapp|proof_upload, direction: inbound|outbound|internal, summary, body, outcome, durationMinutes, followUpAt, occurredAt, actorId, actorName, attachments: [{ fileName, url, mimeType, sizeBytes }], createdAt }`

## Edit Lock
`{ id, entityType, entityId, adminId, adminName, lockedAt, expiresAt }` + computed `isMine` per requester. TTL index on `expiresAt`.

## Content (CMS)
`{ _id, referenceId, slug (unique), section: home|onboarding|faq|legal|about|news|general|banner, title, excerpt, body, category, status: draft|published|archived, imageUrl, cta: { label, target }, tags[], order, metadata: object, publishedAt, createdAt, updatedAt }`

Config records keyed by slug (stored in `metadata`, `body` also mirrors `JSON.stringify(metadata)`):
| Slug | section | `metadata` shape |
| --- | --- | --- |
| `home-screen-layout-config` | home | `{ sections: [{ id, label, description, isActive, canDisable, order }] }` |
| `home-screen-banners-config` | banner | `{ banners: [{ id, title, subtitle, ctaText, bgColor, imageUrl, navigateTo, externalUrl, startDate, expiryDate, isActive, order }] }` |
| `featured-upcoming-property-order` | home | `{ featuredOrder: propertyId[], upcomingOrder: propertyId[] }` |
| `onboarding-slides-config` | onboarding | `{ slides: [{ id, order, title, description, imageUrl, isActive }] }` |
| `property-type-visibility-config` | general | `{ propertyTypes: [{ id, slug, typeName, displayName, showOnBuy, showOnSell, order }] }` |
| `app-force-update-config` | general | `{ forceUpdate: { enabled, minVersion, … } }` |
| `tools-operational-config` | general | `{ cities: [{ id, city, state, active }], localities: [{ id, locality, city, active }], zones: [{ id, name, city, coordinates, active }], boostOrders: [{ id, propertyId, property, plan, started, expires, status }] }` |
| `terms-of-service`, `privacy-policy` | legal | `body` = document text; `metadata.lastUpdatedLabel` |
| `about-builtglory` | about | `{ version, buildNumber, releaseDate, companyName, companyWebsite, supportEmail, supportPhone, instagram }` |

The customer app should read these records (public content endpoint) to drive the home screen, banners, onboarding, etc.

## Settings
```ts
{
  organization: { name, tagline, email, phone, address, city, state, pincode },
  app: { maintenance=false, registration=true, kycRequired=false, showPrices=true, virtualTours=true, stagePayment=true, interior=true },
  sla: { interiorHours=24, stagePaymentHours=48, enquiryHours=24, autoEscalate=true, escalateToAdminId, escalateToName },
  alerts: { triggers: Record<string, boolean>, email, whatsapp },
  notifications: { contact: { phone, email, ccEmail }, email: Record<string, boolean>, whatsapp: Record<string, boolean> },
  display: { timezone: IST|GST|SGT|GMT|EST|PST (default IST), dateFormat: 'DD MMM YYYY'|'DD/MM/YYYY'|'MMM DD, YYYY'|'YYYY-MM-DD', currencyFormat: indian|international },
  tools: {
    boostPlans: [{ id, name, priceLabel, description, benefits[], active }],
    interiorPackages: [{ id, name, priceRange, timeline, active }],
    coupons: [{ id, code, discount, type: '% discount'|'Flat discount', appliesTo, uses, expiry, active }]
  },
  updatedAt
}
```
Defaults shown above are what the UI assumes when a key is missing — the backend should apply the same defaults.

## Report Export
`{ _id, referenceId, status: queued|processing|ready|failed|expired, format, exportTypes: [reportType], filters: { reportType, format, fields[], deliveryEmail, estimatedRows }, requestedAt, completedAt, expiresAt, failureReason, fileName, rowCount }`

## Notification
See [01-API-CONTRACT.md §3](01-API-CONTRACT.md#3-overview-search-notifications).
