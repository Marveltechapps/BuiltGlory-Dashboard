import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { checksDone, checksSection } from '../../../components/detail/checks';
import { detailStateOf } from '../../../components/detail/detailState';
import { legalSection, SELLER_LEGAL, type LegalState } from '../../../components/detail/legalChecklist';
import { methodLabel, payForm, payValid, printReceipt } from '../../../components/detail/payment';
import { btn, personSection } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { ACQ_STAGES } from '../../../constants/labels';
import { STAGE_DOT } from '../../../constants/pipeline';
import { SLOTS } from '../../../constants/enquiries';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { callPhone } from '../../../lib/contact';
import { acqStage, badge, date, price, relativeLong, shortId, statusLabel, todayIso, typeLabel } from '../../../lib/format';
import { arr, asRaw, num, str, type Raw } from '../../../lib/raw';
import { convertAcquisitionToProperty, getAcquisition, updateAcquisition, updateAcquisitionSection, updateAcquisitionStage, type AcquisitionSection } from '../../../services/acquisitions';
import { updateProperty } from '../../../services/properties';
import { sendPush, uploadProof } from '../../../services/workflow';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import type { SectionSpec } from '../../../types/detail';

const FLOW = ACQ_STAGES.slice(0, 7).map(([value, label]) => ({ value, label }));
const TAB: Record<string, string> = { pending_review: 'pending', site_inspection: 'inspection', valuation: 'valuation', negotiation: 'negotiation', token_to_seller: 'token', documentation: 'documentation', seller_payout: 'payout', acquired: 'acquired', rejected: 'rejected', on_hold: 'on-hold' };
const REVIEW = ['Photos reviewed', 'Price is reasonable for locality', 'Ownership documents present', 'Seller identity verified', 'Location verified on map'];
const PREACQ = ['All documents verified', 'Payment proof uploaded', 'Seller confirmation received', 'Legal clearance confirmed', 'Property handover scheduled'];
const ADV_CHECKS = ['Registration Records verified', 'Revenue Records verified', 'Approvals & Planning verified', 'Tax & Utility Records verified', 'Loan & Encumbrance verified', 'Court Records verified', 'Government Acquisition Records verified', 'Ownership type documents verified'];
const REJECT_REASONS = ['Price too high', 'Poor condition', 'Location not suitable', 'Incomplete info', 'Duplicate', 'Other'];

export function AcquisitionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['acquisition', id], queryFn: ({ signal }) => getAcquisition(id, signal), retry: false });
  const a = q.data;
  const { team, nameOf } = useSalesTeam();
  const wf = useWorkflowSections('acquisition', id, f, a?.createdAt);
  const lock = useEditLock('acquisition', id);
  const run = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['acquisition', id], ['acquisitions']]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !a) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/acquisition/all" />;

  const today = todayIso();
  const stage = a.stage;
  const label = acqStage(stage);
  const idx = FLOW.findIndex((x) => x.value === stage);
  const first = a.sellerName.split(' ')[0];
  const entity = { type: 'acquisition' as const, id: a.id };
  const doc = a.documentation;
  const wfd = asRaw(doc.workflow);
  const val = a.valuation;
  const ins = asRaw(val.siteInspection);
  const rep = ins.report ? asRaw(ins.report) : null;
  const offers = arr(a.negotiation.offers).map((o) => asRaw(o));
  const tok = a.token;
  const tokPay = asRaw(tok.payment);
  const tokPaid = tok.paid === true || num(tokPay.amount) != null;
  const tokAmount = num(tokPay.amount ?? tok.amount) ?? 0;
  const pay = a.payout;
  const payDone = pay.completed === true;
  const assigned = nameOf(a.assignedTo, a.assignedName) || a.assignedName;
  const days = a.daysInStage;
  const offerAmt = a.builtgloryOffer || 0;

  const exec = (fn: () => Promise<unknown>, msg?: string) => run.mutateAsync(fn).then(() => { if (msg) toast(msg); });
  const move = (to: string, extra: Raw = {}, msg?: string) =>
    exec(() => updateAcquisitionStage(a.id, to, extra)).then(() => {
      setStageBanner(acqStage(to));
      toast(msg || 'Stage updated to ' + acqStage(to));
    });
  const section = (s: AcquisitionSection, data: Raw, extra: Raw = {}, msg?: string) => exec(() => updateAcquisitionSection(a.id, s, data, extra), msg);
  const saveDoc = (patch: Raw, msg?: string) => exec(() => updateAcquisition(a.id, { documentation: { ...doc, ...patch } }), msg);
  const saveWf = (patch: Raw, msg?: string) => saveDoc({ workflow: { ...wfd, ...patch } }, msg);
  const msgSeller = (ch: 'whatsapp' | 'email', body?: string) => openCompose({ channel: ch, name: a.sellerName, to: ch === 'email' ? a.sellerEmail : a.sellerPhone, entity, body, property: a.title });
  const notifySeller = (title: string, body: string) => (a.sellerId ? sendPush('acquisition', a.id, { userId: a.sellerId, audience: 'seller', notificationId: 'N-02', template: { title, body } }).catch(() => null) : Promise.resolve(null));
  const next = (actions: SectionSpec['actions'], note?: SectionSpec['banners']): SectionSpec => ({ key: 'next', title: 'Next Step', tone: 'next', stack: true, banners: note || [], actions });

  const reject = (title?: string, preset?: string) =>
    modal.open({
      title: title || '❌ Reject This Property',
      fields: [
        { key: 'reason', label: 'Select reason', type: 'select', options: REJECT_REASONS, required: true, default: preset || '', reqMsg: 'Select a reason' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
        { key: 'notify', label: 'Notify seller', type: 'checkbox', default: true },
      ],
      submit: 'Confirm Reject',
      tone: 'destructive',
      onSubmit: async (v) => {
        await updateAcquisitionStage(a.id, 'rejected', { rejectionReason: String(v.reason), notes: String(v.notes || ''), reason: String(v.reason) });
        await updateAcquisition(a.id, { documentation: { ...doc, workflow: { ...wfd, rejectedStage: stage, sellerNotified: !!v.notify } } });
        if (v.notify) await notifySeller('Listing update', 'We are unable to proceed with ' + a.title + ' at this time.');
        void q.refetch();
        setStageBanner(acqStage('rejected'));
        toast('❌ Property rejected');
      },
    });
  const hold = () =>
    modal.open({
      title: '⏸️ Put On Hold',
      fields: [{ key: 'reason', label: 'Reason (required)', placeholder: 'Why is this on hold?', required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }],
      submit: 'Put On Hold',
      onSubmit: async (v) => {
        await updateAcquisitionStage(a.id, 'on_hold', { onHoldReason: String(v.reason), notes: String(v.notes || '') });
        await updateAcquisition(a.id, { documentation: { ...doc, workflow: { ...wfd, prevStage: stage } } });
        void q.refetch();
        setStageBanner(acqStage('on_hold'));
        toast('⏸️ Put on hold');
      },
    });

  const main: Array<SectionSpec | null> = [];
  const photos = a.photos;

  if (stage === 'pending_review') {
    const review = asRaw(wfd.reviewChecklist);
    const done = checksDone(REVIEW, review);
    main.push(
      {
        title: 'Listing Details',
        fields: [
          { label: 'Title', value: a.title, strong: true },
          { label: 'Type', value: typeLabel(a.type) },
          { label: 'Asking Price', value: price(a.askingPrice), strong: true },
          { label: 'Location', value: a.location },
          { label: 'Source', value: a.sellRequestId ? 'Sell request' : a.createdFrom === 'manual' ? 'Manually created' : 'App submission' },
        ],
        actions: a.sellRequestId ? [btn('View Sell Request →', () => navigate('/admin/enquiries/sell/' + a.sellRequestId), 'link')] : [],
      },
      {
        title: 'Property Photos',
        tag: 'App: SL-05',
        images: photos,
        empty: photos.length ? '' : 'No photos submitted',
        actions: photos.length ? [] : [btn('Request Photos', () => msgSeller('whatsapp', 'Hi ' + first + ', please upload photos of ' + a.title + '.'))],
      },
      {
        title: 'Media & Documents',
        fields: [
          { label: 'Video Walkthrough', value: str(asRaw(a.propertyDetails.media).videoUrl) ? 'Uploaded' : 'Not uploaded' },
          { label: 'Drone / Aerial View', value: str(asRaw(a.propertyDetails.media).droneVideoUrl) ? 'Uploaded' : 'Not uploaded' },
          { label: '3D Virtual Tour', value: str(asRaw(a.propertyDetails.media).tourUrl3D) ? 'Uploaded' : 'Not uploaded' },
          { label: 'Floor Plan', value: str(asRaw(a.propertyDetails.media).floorPlanUrl) ? 'Uploaded' : 'Not uploaded' },
        ],
        banners: [
          a.sellerType === 'nri' && !str(asRaw(a.propertyDetails.media).tourUrl3D) ? { text: '⚠️ NRI property without virtual tour — request from seller', tone: 'warn' } : null,
          !str(asRaw(a.propertyDetails.media).floorPlanUrl) ? { text: 'No floor plan — consider requesting from seller', tone: 'muted' } : null,
        ],
      },
      {
        title: 'Seller Verification',
        fields: [{ label: 'Seller', value: a.sellerName }, { label: 'KYC status', value: statusLabel(a.sellerKycStatus) }],
        actions: a.sellerId ? [btn('View History', () => navigate('/admin/users/' + a.sellerId))] : [],
      },
      checksSection('Review Checklist', REVIEW, review, (nextState) => void saveWf({ reviewChecklist: nextState }), 'Check before deciding · ' + done + '/' + REVIEW.length),
      next([
        btn('✅ Accept — Schedule Inspection', () =>
          modal.open({
            title: 'Schedule Site Inspection',
            banners: done < REVIEW.length ? [{ text: 'Review checklist incomplete — proceed anyway?', tone: 'warn' }] : [],
            formCols: 2,
            fields: [
              { key: 'by', label: 'Inspector name', required: true },
              { key: 'date', label: 'Date', type: 'date', min: today, required: true },
              { key: 'time', label: 'Time', type: 'select', options: SLOTS, default: '11:00 AM' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ],
            validate: (v) => ({ date: String(v.date) < today ? 'Date is in the past' : '' }),
            submit: done < REVIEW.length ? 'Confirm & Move to Inspection' : 'Move to Inspection',
            onSubmit: (v) => move('site_inspection', { valuation: { ...val, siteInspection: { inspector: v.by, date: v.date, time: v.time, notes: v.notes || '' } } }, '📅 Inspection scheduled'),
          }), 'green'),
        btn('📝 Request More Info from Seller (WhatsApp)', () => msgSeller('whatsapp', 'Hi ' + first + ', we need a few more details about ' + a.title + ' to continue the review.')),
        btn('📝 Request More Info from Seller (Email)', () => msgSeller('email', 'Hi ' + first + ',\n\nWe need a few more details about ' + a.title + '.')),
        btn('❌ Reject This Property', () => reject(), 'red'),
      ]),
    );
  }

  if (stage === 'site_inspection') {
    const insDate = str(ins.date);
    const overdue = insDate && insDate < today && !rep;
    const saveIns = (patch: Raw, msg?: string) => section('valuation', { ...val, siteInspection: { ...ins, ...patch } }, {}, msg);
    main.push(
      {
        title: 'Inspection Schedule',
        fields: [
          { label: 'Inspector', value: str(ins.inspector) || assigned },
          { label: 'Scheduled', value: insDate ? date(insDate + 'T12:00:00') + ', ' + str(ins.time) : 'Not scheduled' },
          { label: 'Notes', value: str(ins.notes) },
        ],
        banners: overdue ? [{ text: '⚠️ Inspection overdue — reschedule or mark completed', tone: 'error' }] : [],
        actions: [
          btn('Reschedule', () =>
            modal.open({
              title: 'Reschedule inspection',
              fields: [{ key: 'date', label: 'Date', type: 'date', min: today, required: true }, { key: 'time', label: 'Time', type: 'select', options: SLOTS, default: '11:00 AM' }],
              onSubmit: (v) => saveIns({ date: v.date, time: v.time }, '📅 Inspection rescheduled'),
            })),
          btn('Cancel', () => askConfirm({ title: 'Cancel inspection?', message: 'The property will move back to Pending Review.', confirmLabel: 'Cancel Inspection', tone: 'destructive', onConfirm: () => move('pending_review', { valuation: { ...val, siteInspection: null } }) }), 'red'),
        ],
      },
      {
        title: 'Expected Specifications',
        subtitle: 'Verify seller-submitted details on site',
        fields: [
          { label: 'Type', value: typeLabel(a.type) },
          { label: 'Asking', value: price(a.askingPrice) },
          { label: 'Location', value: a.location },
          ...Object.entries(asRaw(a.propertyDetails.specifications)).slice(0, 6).map(([k, v]) => ({ label: statusLabel(k.replace(/([A-Z])/g, ' $1')), value: str(v) })),
        ],
      },
      !ins.completed && !rep
        ? { title: 'Inspection Report', banners: [{ text: '🔒 Locked until inspection is completed', tone: 'muted' }], actions: [btn('Mark Inspection Complete', () => void saveIns({ completed: true, completedAt: new Date().toISOString() }, 'Inspection completed'), 'primary')] }
        : rep
          ? {
              title: 'Inspection Report',
              banners: [{ text: '✅ Report saved', tone: 'success' }],
              fields: [
                { label: 'Overall Condition', value: str(rep.condition) },
                { label: 'Structural Issues', value: str(rep.structural) },
                { label: 'Repair cost', value: num(rep.repairCost) ? price(num(rep.repairCost)) : '—' },
                { label: 'Recommendation', value: str(rep.recommendation) },
                { label: 'Site photos', value: (num(rep.photos) ?? 0) + ' uploaded' },
              ],
              text: str(rep.notes),
              actions: [btn('Edit report', () => void saveIns({ report: null, completed: true }))],
            }
          : {
              title: 'Inspection Report',
              form: [
                f.inp('r.cond', 'Overall Condition', { type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'], required: true }),
                f.inp('r.struct', 'Structural Issues Found?', { type: 'select', options: ['No', 'Yes'], default: 'No' }),
                f.str('r.struct') === 'Yes' ? f.inp('r.repair', 'Estimated repair cost (₹)', { type: 'number', required: true }) : null,
                f.inp('r.photos', 'Site Photos (count uploaded)', { type: 'number', hint: 'Upload site photos as proofs in the call log / notes' }),
                f.inp('r.rec', 'Your Recommendation', { type: 'select', options: ['Proceed ✅', 'Proceed with Caution ⚠️', 'Recommend Reject ❌'], required: true }),
                f.inp('r.notes', 'Condition notes', { type: 'textarea' }),
              ],
              actions: [
                btn('Save Inspection Report', () => {
                  const req: Record<string, string> = { 'r.cond': 'Overall condition is required', 'r.rec': 'Recommendation is required' };
                  if (f.str('r.struct') === 'Yes') req['r.repair'] = 'Estimated repair cost (₹) is required';
                  if (!f.need(req)) return;
                  if (!(Number(f.str('r.photos')) > 0)) return void f.fail('r.photos', 'Add photos before saving report');
                  void saveIns(
                    { report: { condition: f.str('r.cond'), structural: f.str('r.struct') || 'No', repairCost: Number(f.str('r.repair')) || 0, photos: Number(f.str('r.photos')), recommendation: f.str('r.rec'), notes: f.str('r.notes') } },
                    '✅ Inspection report saved',
                  ).then(() => f.clear('r.'));
                }, 'primary'),
              ],
            },
      next(
        [
          btn('✅ Move to Valuation', () => {
            if (!rep) return toast('Save the inspection report first');
            if (str(rep.recommendation).includes('Reject')) askConfirm({ title: 'Recommendation is reject', message: 'Recommendation is reject. Proceed to valuation anyway?', confirmLabel: 'Proceed', onConfirm: () => move('valuation') });
            else void move('valuation');
          }, 'green', { disabled: !rep }),
          btn('❌ Reject — Poor Condition', () => reject('❌ Reject — Poor Condition', 'Poor condition'), 'red'),
        ],
        rep && str(rep.recommendation).includes('Caution') ? [{ text: '⚠️ Inspector recommends proceeding with caution', tone: 'warn' }] : [],
      ),
    );
  }

  if (stage === 'valuation') {
    const saved = num(val.marketValue) != null;
    const mv = num(val.marketValue) ?? 0;
    const gapPct = offerAmt ? ((a.askingPrice - offerAmt) / a.askingPrice) * 100 : 0;
    main.push(
      { title: 'Inspection Summary', fields: rep ? [{ label: 'Condition', value: str(rep.condition) }, { label: 'Structural issues', value: str(rep.structural) }, { label: 'Repair cost', value: num(rep.repairCost) ? price(num(rep.repairCost)) : '—' }] : [], empty: rep ? '' : 'No inspection report found' },
      saved
        ? {
            title: 'Property Valuation',
            banners: [{ text: '✅ Valuation saved by ' + (str(val.valuedBy) || 'Admin') + (str(val.valuationDate) ? ' on ' + date(str(val.valuationDate)) : ''), tone: 'success' }],
            fields: [{ label: 'Current Market Value', value: price(mv), strong: true }, { label: "Builtglory's Offer Price", value: offerAmt ? price(offerAmt) : '—', strong: true, color: '#15803d' }, { label: 'Comparables', value: str(val.comparables) }],
            text: str(val.notes),
            actions: [btn('Edit valuation', () => { f.set('v.by', str(val.valuedBy)); f.set('v.market', String(mv)); f.set('v.offer', String(offerAmt || '')); f.set('v.edit', true); })],
          }
        : null,
      !saved || f.val<boolean>('v.edit', false)
        ? {
            title: saved ? 'Edit Valuation' : 'Property Valuation',
            form: [
              f.inp('v.by', 'Valued by', { required: true }),
              f.inp('v.date', 'Valuation date', { type: 'date', required: true, max: today, default: today }),
              f.inp('v.market', 'Current Market Value (₹)', { type: 'number', required: true }),
              f.inp('v.offer', "Builtglory's Offer Price (₹)", { type: 'number', required: true, hint: 'What Builtglory is willing to pay' }),
              f.inp('v.comps', 'Comparable properties'),
              f.inp('v.notes', 'Valuation notes', { type: 'textarea' }),
            ],
            actions: [
              btn('Save Valuation', () => {
                if (!f.need({ 'v.by': 'Valued by is required', 'v.market': 'Market value is required', 'v.offer': 'Offer price is required' })) return;
                const d = f.str('v.date', today);
                if (d > today) return void f.fail('v.date', 'Valuation date cannot be in the future');
                void section('valuation', { ...val, valuedBy: f.str('v.by'), valuationDate: d, marketValue: Number(f.str('v.market')), builtgloryValuation: Number(f.str('v.offer')), comparables: f.str('v.comps'), notes: f.str('v.notes') }, { builtgloryOffer: Number(f.str('v.offer')) }, '✅ Valuation saved').then(() => f.clear('v.'));
              }, 'primary'),
            ],
          }
        : null,
      {
        title: 'Price Analysis',
        cols: 3,
        fields: [{ label: 'Asking Price', value: price(a.askingPrice), strong: true }, { label: 'Market Value', value: mv ? price(mv) : '—', strong: true }, { label: 'BG Offer', value: offerAmt ? price(offerAmt) : '—', strong: true, color: '#15803d' }],
        banners: offerAmt
          ? [offerAmt < a.askingPrice ? { text: '✅ Great deal — offer below asking price (' + gapPct.toFixed(1) + '% gap)', tone: 'success' } : { text: 'Offer exceeds asking — great acquisition opportunity', tone: 'info' }, gapPct > 25 ? { text: '🚫 Very large gap — likely to reject', tone: 'error' } : null]
          : [],
      },
      next([
        btn('💬 Start Negotiation with Seller', () => (saved ? void move('negotiation', { negotiation: { ...a.negotiation, offers: [{ amount: offerAmt, by: 'Builtglory', status: 'active', notes: 'Initial offer', offeredAt: new Date().toISOString() }] } }) : toast('Save the valuation first')), 'green', { disabled: !saved }),
        btn('❌ Reject — Price Gap Too Large', () => reject('❌ Reject — Price Gap Too Large', 'Price too high'), 'red'),
      ]),
    );
  }

  if (stage === 'negotiation') {
    const lastSeller = [...offers].reverse().find((o) => o.by === 'Seller');
    const lastAny = offers[offers.length - 1];
    const dl = str(wfd.negotiationDeadline);
    const dlPassed = !!dl && dl < today;
    const confirmDeal = () =>
      modal.open({
        title: 'Confirm Deal',
        fields: [
          { key: 'price', label: 'Final agreed price (₹)', type: 'number', required: true, default: String(num((lastSeller || lastAny)?.amount) ?? (offerAmt || '')) },
          { key: 'mgmt', label: 'Management approval obtained', type: 'checkbox' },
        ],
        validate: (v) => ({ mgmt: Number(v.price) < a.askingPrice * 0.8 && !v.mgmt ? 'Large discount — get management approval' : '' }),
        submit: '✅ Deal Agreed — Move to Token Payment',
        tone: 'green',
        onSubmit: (v) => move('token_to_seller', { agreedPrice: Number(v.price), negotiation: { ...a.negotiation, agreedPrice: Number(v.price) } }, '🎉 Deal agreed at ' + price(Number(v.price))),
      });
    main.push(
      { title: 'Negotiation Overview', cols: 3, fields: [{ label: 'Asking', value: price(a.askingPrice), strong: true }, { label: 'BG Offer', value: offerAmt ? price(offerAmt) : '—', strong: true, color: '#15803d' }, { label: 'Gap', value: offerAmt ? price(a.askingPrice - offerAmt) : '—', strong: true, color: '#c2410c' }] },
      {
        title: 'Offer History',
        rows: offers.map((o, i) => ({
          key: String(i),
          title: price(num(o.amount)) + ' · ' + str(o.by),
          sub: (str(o.notes) || '') + (o.offeredAt ? ' · ' + relativeLong(str(o.offeredAt)) : ''),
          badges: [badge(statusLabel(str(o.status, 'active')), str(o.status) === 'accepted' ? 'green' : str(o.status) === 'rejected' ? 'red' : str(o.status) === 'countered' ? 'purple' : 'orange'), (num(o.amount) ?? 0) > a.askingPrice ? badge('Above asking price', 'orange') : null],
        })),
        empty: offers.length ? '' : "No offers yet — Start with Builtglory's initial offer",
        banners: [offers.length >= 5 ? { text: 'Many offers exchanged — consider making a final offer', tone: 'warn' } : null, lastSeller && (num(lastSeller.amount) ?? 0) > a.askingPrice ? { text: 'Seller increased price above original asking', tone: 'warn' } : null],
        form: [
          f.inp('o.amt', 'Amount (₹)', { type: 'number', required: true }),
          f.inp('o.by', 'Offered by', { type: 'select', options: ['Builtglory', 'Seller'], default: 'Builtglory' }),
          f.inp('o.st', 'Status', { type: 'select', options: ['Active', 'Accepted', 'Rejected', 'Countered'], default: 'Active' }),
          f.inp('o.notes', 'Notes'),
        ],
        actions: [
          btn('+ Make Offer', () => {
            if (!f.need({ 'o.amt': 'Amount is required' })) return;
            const amt = Number(f.str('o.amt'));
            const by = f.str('o.by', 'Builtglory');
            const nextOffers = offers.map((x) => (x.status === 'active' ? { ...x, status: 'countered' } : x)).concat([{ amount: amt, by, status: f.str('o.st', 'Active').toLowerCase(), notes: f.str('o.notes'), offeredAt: new Date().toISOString() }]);
            void section('negotiation', { ...a.negotiation, offers: nextOffers }, by === 'Builtglory' ? { builtgloryOffer: amt } : {}, amt > a.askingPrice ? 'Offering above asking — great for seller' : '💰 Offer recorded').then(() => f.clear('o.'));
          }, 'primary'),
          lastSeller ? btn('✅ Accept This Offer', confirmDeal, 'green') : null,
        ],
      },
      {
        title: 'Negotiation Deadline',
        fields: [{ label: 'Deadline', value: dl ? date(dl + 'T12:00:00') : 'Not set', color: dlPassed ? '#dc2626' : '#0f172a', strong: !!dl }],
        banners: dlPassed ? [{ text: '⚠️ Deadline passed — close or extend negotiation', tone: 'error' }] : [],
        form: [f.inp('dl', dl ? 'Change' : 'Set Deadline', { type: 'date', min: today })],
        actions: [
          btn(dl ? 'Change' : '+ Set Deadline', () => {
            if (!f.str('dl')) return void f.fail('dl', 'Pick a date');
            void saveWf({ negotiationDeadline: f.str('dl') }, '⏱ Deadline set').then(() => f.set('dl', ''));
          }),
          dl ? btn('Remove', () => void saveWf({ negotiationDeadline: null }), 'red') : null,
        ],
      },
      {
        title: 'Send Offer to Seller',
        actions: [
          btn('💬 WhatsApp', () => msgSeller('whatsapp', 'Hi ' + first + ', Builtglory would like to offer ' + price(offerAmt) + ' for ' + a.title + '.'), 'green'),
          btn('📧 Email', () => msgSeller('email', 'Hi ' + first + ',\n\nOur offer for ' + a.title + ' is ' + price(offerAmt) + '.')),
        ],
        banners: lastAny && lastAny.offeredAt && Date.now() - Date.parse(str(lastAny.offeredAt)) > 48 * 36e5 ? [{ text: 'No seller response in 48 hours', tone: 'warn', action: { label: 'Send reminder', onClick: () => msgSeller('whatsapp', 'Hi ' + first + ', a gentle reminder about our offer for ' + a.title + '.') } }] : [],
      },
      next([btn('🤝 Confirm Deal', confirmDeal, 'green'), btn('❌ Negotiation Failed', () => reject('❌ Negotiation Failed', 'Price too high'), 'red')]),
    );
  }

  if (stage === 'token_to_seller') {
    if (!a.agreedPrice) {
      main.push({ title: 'Token to Seller', banners: [{ text: 'No agreed price found', tone: 'error' }], actions: [btn('← Back to Negotiation', () => void move('negotiation'))] });
    } else {
      const suggested = Math.round((a.agreedPrice * 0.05) / 1e4) * 1e4;
      const receiptRows: Array<[string, string]> = [
        ['Receipt No', 'TR-' + shortId(a.id, a.referenceId)],
        ['Date', date(str(tokPay.paymentDate))],
        ['Seller', a.sellerName],
        ['Property', a.title],
        ['Token Amount', price(tokAmount)],
        ['Method', methodLabel(tokPay.method)],
        ['Reference', str(tokPay.reference)],
      ];
      main.push(
        { title: '🎉 Deal Agreed!', subtitle: 'Deal Summary', cols: 3, fields: [{ label: 'Asking Price', value: price(a.askingPrice) }, { label: 'Agreed Price', value: price(a.agreedPrice), strong: true, color: '#15803d' }, { label: 'Savings', value: price(Math.max(0, a.askingPrice - a.agreedPrice)), color: '#15803d' }] },
        tokPaid
          ? {
              title: 'BUILTGLORY — Token Receipt',
              fields: receiptRows.map(([l, v]) => ({ label: l, value: v, strong: l === 'Token Amount' })),
              text: 'Balance due on documentation completion.',
              actions: [
                btn('📥 Download Receipt', () => printReceipt('Token Receipt', receiptRows, 'Balance due on documentation completion.')),
                btn('Send to Seller (WhatsApp)', () => msgSeller('whatsapp', 'Token of ' + price(tokAmount) + ' paid for ' + a.title + '. Ref ' + str(tokPay.reference) + '.')),
                btn('Send to Seller (Email)', () => msgSeller('email', 'Token receipt for ' + a.title)),
                btn('Update Payment', () => void section('token', { paid: false, amount: 0 })),
              ],
            }
          : {
              title: 'Token Payment to Seller',
              form: payForm(f, 't.', today, { amountLabel: 'Token amount (₹)', amount: suggested }),
              actions: [
                btn('Record Token Payment', () => {
                  const p = payValid(f, 't.', today, { amount: suggested }, { zeroMsg: 'Token cannot be 0' });
                  if (!p) return;
                  void section('token', { paid: true, amount: p.amount, payment: p }, {}, '✅ Token payment recorded').then(() => f.clear('t.'));
                }, 'primary'),
              ],
            },
        next([btn('📄 Move to Documentation', () => void move('documentation'), 'green', { disabled: !tokPaid })], tokPaid ? [] : [{ text: 'Record the token payment to continue', tone: 'muted' }]),
      );
    }
  }

  const legal = legalSection({
    mode: 'seller',
    state: doc as LegalState,
    f,
    party: { name: a.sellerName, phone: a.sellerPhone, email: a.sellerEmail },
    entity,
    openForm: modal.open,
    save: (patch) => saveDoc(patch as Raw),
    upload: async (file, name) => (await uploadProof('acquisition', a.id, file, { summary: 'Document uploaded: ' + name })).attachments[0]?.url || '',
  });

  if (stage === 'documentation') {
    const own = asRaw(doc.ownership);
    const adv = doc.advocate ? asRaw(doc.advocate) : null;
    const issues = arr(doc.issues).map((x) => str(x));
    const advChecks = asRaw(doc.advocateChecklist);
    const advDone = checksDone(ADV_CHECKS, advChecks);
    const cert = asRaw(doc.certificate);
    const legalVerifiedAt = str(doc.legalVerifiedAt);
    const ownType = f.str('own', str(own.type));
    const leaseRem = Number(f.str('lease.rem', str(own.remaining)));
    main.push(
      { title: 'Token Payment Summary', cols: 3, fields: [{ label: 'Agreed Price', value: price(a.agreedPrice || 0), strong: true }, { label: 'Token Paid', value: tokPaid ? price(tokAmount) : '—' }, { label: 'Balance Due', value: price((a.agreedPrice || 0) - (tokPaid ? tokAmount : 0)), color: '#c2410c', strong: true }, { label: 'Payment Method', value: tokPaid ? methodLabel(tokPay.method) : '—' }] },
      {
        title: 'Property Ownership Type',
        chips: [['freehold', 'Freehold / Ownership Land'], ['leasehold', 'Leasehold / Lease Land']].map(([k, l]) => ({ label: l!, on: ownType === k, onClick: () => f.set('own', k!) })),
        banners: [
          own.type ? { text: '✅ Confirmed: ' + (own.type === 'leasehold' ? 'Leasehold' : 'Freehold'), tone: 'success' } : null,
          ownType === 'leasehold' && leaseRem > 0 && leaseRem < 10 ? { text: '⚠️ Less than 10 years remaining. Banks may not approve buyer loans.', tone: 'error' } : null,
          f.str('lease.type') === 'Government' ? { text: 'Govt lease — NOC takes 30-90 days to process', tone: 'warn' } : null,
        ],
        form:
          ownType === 'leasehold'
            ? [
                f.inp('lease.period', 'Lease Period (years)', { type: 'number', default: str(own.period) }),
                f.inp('lease.start', 'Lease Start Date', { type: 'date', default: str(own.start) }),
                f.inp('lease.lessor', 'Lessor Name', { default: str(own.lessor) }),
                f.inp('lease.type', 'Lessor Type', { type: 'select', options: ['Government', 'Semi-Government', 'Private', 'Religious Trust'], default: str(own.lessorType) }),
                f.inp('lease.noc', 'NOC from Lessor', { type: 'select', options: ['Yes', 'No'], default: str(own.noc) }),
                f.inp('lease.rem', 'Lease Remaining (years)', { type: 'number', default: str(own.remaining) }),
              ]
            : [],
        actions: [
          btn(own.type ? 'Change' : 'Confirm', () => {
            if (!ownType) return toast('Select an ownership type');
            void saveDoc(
              { ownership: ownType === 'leasehold' ? { type: ownType, period: f.str('lease.period', str(own.period)), start: f.str('lease.start', str(own.start)), lessor: f.str('lease.lessor', str(own.lessor)), lessorType: f.str('lease.type', str(own.lessorType)), noc: f.str('lease.noc', str(own.noc)), remaining: Number(f.str('lease.rem', str(own.remaining))) || null } : { type: ownType } },
              '✅ Ownership type confirmed',
            );
          }, 'primary'),
        ],
      },
      legal,
      {
        title: 'Legal Advocate Verification',
        subtitle: 'Step 1 · Assign Legal Advocate',
        fields: adv ? [{ label: 'Advocate', value: str(adv.name), strong: true }, { label: 'Bar Council Number', value: str(adv.bar) }, { label: 'Phone', value: str(adv.phone) }, { label: 'Law Firm', value: str(adv.firm) }] : [],
        form: adv
          ? []
          : [
              f.inp('adv.name', 'Advocate Name', { required: true }),
              f.inp('adv.bar', 'Bar Council Number', { required: true, hint: 'Format: STATE/NUMBERS/YEAR (e.g. KAR/1234/2010)' }),
              f.inp('adv.phone', 'Phone', { required: true }),
              f.inp('adv.email', 'Email'),
              f.inp('adv.firm', 'Law Firm / Chamber'),
              f.inp('adv.fee', 'Verification Fee (₹)', { type: 'number' }),
            ],
        actions: [
          adv
            ? btn('Change Advocate', () => void saveDoc({ advocate: null, legalVerifiedAt: null }))
            : btn('Assign Advocate', () => {
                if (!f.need({ 'adv.name': 'Advocate name is required', 'adv.bar': 'Bar Council Number is required', 'adv.phone': 'Phone is required' })) return;
                if (!/^[A-Z]{2,4}\/\d+\/\d{4}$/.test(f.str('adv.bar'))) return void f.fail('adv.bar', 'Format: STATE/NUMBERS/YEAR (e.g. KAR/1234/2010)');
                void saveDoc({ advocate: { name: f.str('adv.name'), bar: f.str('adv.bar'), phone: f.str('adv.phone'), email: f.str('adv.email'), firm: f.str('adv.firm'), fee: Number(f.str('adv.fee')) || null } }, '⚖️ Advocate assigned').then(() => f.clear('adv.'));
              }, 'primary'),
        ],
      },
      adv ? { ...checksSection('Step 2 · Document Review Checklist', ADV_CHECKS, advChecks, (nextState) => void saveDoc({ advocateChecklist: nextState })), subtitle: advDone + '/' + ADV_CHECKS.length + ' verified' } : null,
      adv
        ? {
            title: 'Step 3 · Advocate Findings',
            rows: issues.map((t, i) => ({ key: String(i), title: t, actions: [{ label: 'Resolve', variant: 'green', onClick: () => void saveDoc({ issues: issues.filter((_, j) => j !== i) }) }] })),
            banners: issues.length ? [{ text: '⚠️ Legal issues found. Resolve before proceeding.', tone: 'error' }] : [],
            form: [f.inp('issue', 'Issue', { placeholder: 'Describe the issue' })],
            actions: [btn('+ Add Issue', () => { const t = f.str('issue').trim(); if (!t) return; void saveDoc({ issues: [...issues, t] }, 'Legal issue logged').then(() => f.set('issue', '')); })],
          }
        : null,
      adv
        ? {
            title: 'Step 4 · Upload Verification Certificate',
            subtitle: 'Mandatory',
            banners: [str(cert.url) ? { text: 'Certificate Uploaded ✅ — ' + str(cert.fileName), tone: 'success' } : { text: 'Certificate not uploaded', tone: 'warn' }],
            actions: [
              btn(str(cert.url) ? 'Replace' : 'Upload Certificate', () =>
                modal.open({
                  title: 'Upload Verification Certificate',
                  fields: [{ key: 'file', label: 'Certificate (PDF / image)', type: 'file', accept: '.pdf,.jpg,.jpeg,.png', required: true }],
                  submit: 'Upload',
                  onSubmit: async (v) => {
                    const file = v.file as File;
                    const log = await uploadProof('acquisition', a.id, file, { summary: 'Legal verification certificate uploaded' });
                    await updateAcquisition(a.id, { documentation: { ...doc, certificate: { url: log.attachments[0]?.url || '', fileName: file.name } } });
                    void q.refetch();
                    toast('📎 Certificate uploaded');
                  },
                })),
            ],
          }
        : null,
      adv && legalVerifiedAt
        ? {
            title: '✅ Legal Verification Complete',
            fields: [{ label: 'Verified by', value: str(adv.name) }, { label: 'Bar Council', value: str(adv.bar) }, { label: 'Verification Date', value: date(legalVerifiedAt) }, { label: 'Certificate', value: str(cert.fileName) }],
            actions: [btn('View Certificate', () => (str(cert.url) ? void window.open(str(cert.url), '_blank', 'noopener,noreferrer') : toast('No certificate file'))), btn('Revoke Verification', () => void saveDoc({ legalVerifiedAt: null }, 'Legal verification revoked'), 'red')],
          }
        : adv
          ? {
              title: 'Complete Verification',
              actions: [
                btn('✅ Mark Verification Complete', () => {
                  if (!str(cert.url)) return toast('Upload the verification certificate first');
                  const doIt = () => saveDoc({ legalVerifiedAt: new Date().toISOString() }, '✅ Legal verification complete');
                  if (issues.length) askConfirm({ title: 'Proceed despite issues?', message: issues.length + ' open legal issue(s).', confirmLabel: 'Proceed', onConfirm: doIt });
                  else void doIt();
                }, 'green'),
              ],
            }
          : null,
      next(
        [
          btn('💰 Move to Seller Payout', () => {
            if (!legalVerifiedAt) return toast('⚠️ Complete legal verification first');
            if (legal.verified < legal.required) askConfirm({ title: 'Proceed anyway?', message: '⚠️ Some optional documents missing. Proceed anyway?', confirmLabel: 'Proceed', onConfirm: () => move('seller_payout') });
            else void move('seller_payout');
          }, 'green'),
        ],
        legalVerifiedAt ? [] : [{ text: '⚠️ Complete legal verification first', tone: 'warn' }],
      ),
    );
  }

  if (stage === 'seller_payout') {
    const balance = (a.agreedPrice || 0) - (tokPaid ? tokAmount : 0);
    const preState = asRaw(wfd.preAcquisitionChecklist);
    const preDone = checksDone(PREACQ, preState);
    const payAmt = num(pay.amount) ?? 0;
    const payRows: Array<[string, string]> = [['Payment No', 'SP-' + shortId(a.id, a.referenceId)], ['Seller', a.sellerName], ['Method', str(pay.method).toUpperCase()], ['Details', str(pay.notes)], ['Final Payment', price(payAmt)], ['Total Paid', price(payAmt + (tokPaid ? tokAmount : 0))]];
    main.push(
      { title: 'Payout Summary', cols: 3, fields: [{ label: 'Agreed Price', value: price(a.agreedPrice || 0) }, { label: 'Token Paid', value: tokPaid ? price(tokAmount) : '—' }, { label: 'Balance Due', value: price(balance), strong: true, color: '#c2410c' }, { label: 'Final Payment', value: payDone ? price(payAmt) : '—', strong: true }] },
      payDone
        ? {
            title: 'Payment Confirmation',
            fields: payRows.map(([l, v]) => ({ label: l, value: v, strong: l === 'Total Paid' })),
            banners: [payAmt === balance ? { text: '✅ Payment complete', tone: 'success' } : payAmt > balance ? { text: '⚠️ Overpayment detected', tone: 'error' } : { text: '⚠️ Payment mismatch — Underpayment warning', tone: 'warn' }],
            actions: [
              btn('📥 Download', () => printReceipt('Seller Payment Confirmation', payRows)),
              btn('Send to Seller', () => msgSeller('whatsapp', 'Final payment of ' + price(payAmt) + ' released for ' + a.title + '.')),
              btn('Update Payment', () => void section('payout', { completed: false, amount: 0, method: '', notes: '' })),
            ],
          }
        : {
            title: 'Final Payment to Seller',
            form: payForm(f, 'p.', today, { amount: balance, proof: true }),
            banners: Number(f.str('p.amount', String(balance))) !== balance ? [{ text: 'Amount mismatch — balance due is ' + price(balance), tone: 'warn' }] : [],
            actions: [
              btn('Request bank details', () => msgSeller('whatsapp', 'Hi ' + first + ', please share your bank account details for the final payout.')),
              btn('Record Payment', () => {
                const p = payValid(f, 'p.', today, { amount: balance }, { proof: true });
                if (!p) return;
                void section('payout', { completed: true, amount: p.amount, method: p.method, notes: 'Ref ' + p.reference + ' · ' + date(p.paymentDate) }, {}, '✅ Payout recorded').then(() => f.clear('p.'));
              }, 'primary'),
            ],
          },
      { ...checksSection('Pre-Acquisition Checklist', PREACQ, preState, (nextState) => void saveWf({ preAcquisitionChecklist: nextState })), subtitle: preDone + '/' + PREACQ.length },
      next(
        [
          btn('🏠 Mark as Acquired', () => {
            if (!payDone) return toast('Record final payment to mark property as acquired');
            askConfirm({ title: 'Mark as owned by Builtglory?', message: a.title + ' will move to Acquired.', confirmLabel: '✅ Confirm Acquisition', tone: 'green', onConfirm: () => move('acquired', { finalPurchasePrice: a.agreedPrice || undefined }, '🏠 Property Acquired!') });
          }, 'green', { disabled: !payDone }),
        ],
        payDone ? [] : [{ text: 'Record final payment to mark property as acquired', tone: 'muted' }],
      ),
    );
  }

  if (stage === 'acquired') {
    const paid = (tokPaid ? tokAmount : 0) + (num(pay.amount) ?? 0) || a.finalPurchasePrice || a.agreedPrice || 0;
    const listedId = a.propertyId || str(wfd.listedPropertyId) || null;
    const lp = Number(f.str('l.price'));
    main.push(
      {
        title: '🏠 Property Acquired!',
        subtitle: 'This property is now owned by Builtglory',
        fields: [
          { label: 'Asking Price', value: price(a.askingPrice) },
          { label: 'Agreed Price', value: price(a.agreedPrice || 0), strong: true },
          { label: 'Total Paid', value: price(paid) },
          { label: 'Savings', value: price(Math.max(0, a.askingPrice - (a.agreedPrice || 0))), color: '#15803d' },
          { label: 'Acquired On', value: date(a.stageEnteredAt) },
          { label: 'Acquired By', value: assigned },
        ],
      },
      listedId
        ? { title: 'Listed', banners: [{ text: '✅ Listed on app', tone: 'success' }], actions: [btn('View Property →', () => navigate('/admin/properties/' + listedId), 'primary')] }
        : {
            title: 'List This Property for Sale',
            subtitle: 'This property is ready to list on app',
            form: [f.inp('l.title', 'Listing title', { default: a.title }), f.inp('l.price', 'Selling price (₹)', { type: 'number', required: true }), f.inp('l.feat', 'Mark as Featured', { type: 'checkbox' }), f.inp('l.up', 'Mark as Upcoming', { type: 'checkbox' })],
            banners: [lp && lp < (a.agreedPrice || 0) ? { text: '⚠️ Selling below acquisition cost / agreed price', tone: 'warn' } : null, f.val<boolean>('l.feat', false) && f.val<boolean>('l.up', false) ? { text: 'Cannot be both Featured and Upcoming', tone: 'error' } : null],
            actions: [
              btn('List Property', () => {
                if (!f.need({ 'l.price': 'Selling price is required' })) return;
                if (f.val<boolean>('l.feat', false) && f.val<boolean>('l.up', false)) return;
                void exec(async () => {
                  const { propertyId } = await convertAcquisitionToProperty(a.id);
                  if (propertyId) await updateProperty(propertyId, { title: f.str('l.title', a.title), price: lp, isFeatured: f.val<boolean>('l.feat', false), isUpcoming: f.val<boolean>('l.up', false) });
                  await updateAcquisition(a.id, { documentation: { ...doc, workflow: { ...wfd, listedPropertyId: propertyId } } });
                }, '✅ Listed on app').then(() => f.clear('l.'));
              }, 'primary'),
            ],
          },
      {
        title: 'Acquisition Documents',
        rows: Object.keys(SELLER_LEGAL).slice(0, 4).map((k) => {
          const names = SELLER_LEGAL[k] ?? [];
          const docsMap = asRaw(doc.docs);
          const ok = names.filter((n) => asRaw(docsMap[n]).status === 'verified').length;
          return { key: k, title: k, sub: ok + '/' + names.length + ' verified', badges: [ok === names.length ? badge('✅ Verified', 'green') : badge('Incomplete', 'amber')] };
        }),
        actions: [btn('Add to Master Sheet →', () => navigate('/admin/tools/mastersheet'), 'link')],
      },
    );
  }

  if (stage === 'rejected') {
    const notified = wfd.sellerNotified !== false;
    main.push(
      {
        title: '❌ Property Rejected',
        fields: [
          { label: 'Rejected On', value: date(a.stageEnteredAt) },
          { label: 'Rejected By', value: assigned },
          { label: 'Stage When', value: str(wfd.rejectedStage) ? acqStage(str(wfd.rejectedStage)) : 'Pending Review' },
          { label: 'Seller Notified', value: notified ? 'Yes' : 'No' },
          { label: 'Reason', value: a.rejectionReason || 'No reason recorded', strong: true },
        ],
      },
      {
        title: 'Seller Notification',
        banners: [notified ? { text: '✅ Seller was notified', tone: 'success' } : { text: '⚠️ Seller not notified', tone: 'warn' }],
        actions: [
          btn(notified ? 'Resend Notification' : 'Send Notification Now (WhatsApp)', () => msgSeller('whatsapp', 'Hi ' + first + ', we are unable to proceed with ' + a.title + ' at this time. Reason: ' + (a.rejectionReason || '—') + '.'), 'primary'),
          btn('Email', () => msgSeller('email', 'Update on your listing ' + a.title)),
        ],
      },
      { title: 'Reconsider This Property', text: 'If circumstances have changed, you can move this property back for review.', actions: [btn('♻️ Move Back to Pending Review', () => askConfirm({ title: 'Move back to Pending Review?', confirmLabel: 'Move Back', onConfirm: () => move('pending_review', { rejectionReason: '' }) }), 'primary')] },
    );
  }

  const prevStage = str(wfd.prevStage) || [...a.stageHistory].reverse().find((h) => h.to === 'on_hold')?.from || '';
  if (stage === 'on_hold') {
    main.push(
      { title: '⏸️ Property On Hold', fields: [{ label: 'Put On Hold', value: date(a.stageEnteredAt) }, { label: 'Held By', value: assigned }, { label: 'Days On Hold', value: days + ' days' }, { label: 'Reason', value: a.onHoldReason, strong: true }] },
      {
        title: 'What would you like to do?',
        stack: true,
        actions: [
          btn('▶️ Resume Acquisition', () =>
            modal.open({
              title: 'Resume Acquisition',
              fields: [{ key: 'to', label: 'Return to stage', type: 'select', options: FLOW.map((x) => ({ value: x.value, label: x.label })), required: true, default: prevStage }],
              submit: 'Confirm',
              onSubmit: (v) => move(String(v.to), { onHoldReason: '' }, '▶️ Acquisition resumed'),
            }), 'green'),
          btn('❌ Reject & Close', () => reject('❌ Reject & Close'), 'red'),
        ],
      },
    );
  }

  main.push(wf.callLog(), wf.notes('Internal Notes'));
  const current = stage === 'acquired' ? FLOW.length : stage === 'on_hold' ? FLOW.findIndex((x) => x.value === prevStage) : idx;

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/acquisition/all"
      crumbs={[{ label: 'Acquisition Pipeline', path: '/admin/acquisition/all' }, { label, path: '/admin/acquisition/' + (TAB[stage] || 'all') }, { label: a.title }]}
      title={a.title}
      badges={[{ text: label, dot: STAGE_DOT.acquisition[stage] || '#94a3b8' }, a.priority !== 'normal' ? { text: statusLabel(a.priority), tone: a.priority === 'urgent' ? 'red' : 'orange' } : null, a.createdFrom === 'manual' ? { text: 'Manually created', tone: 'muted' } : null]}
      meta={shortId(a.id, a.referenceId) + ' • Created: ' + date(a.createdAt) + ' • ' + days + ' days in current stage' + (days > 14 && idx >= 0 ? ' • ⚠️ Stalled' : '')}
      hActions={[
        btn('📞 Call Seller', () => callPhone(a.sellerName, a.sellerPhone)),
        btn('💬 WhatsApp', () => msgSeller('whatsapp'), 'green'),
        btn('📧 Email', () => msgSeller('email'), 'outline', { disabled: !a.sellerEmail }),
        btn('👤 Assign To' + (assigned ? ': ' + assigned : ''), () => {
          const avail = team.filter((m) => m.isAvailable);
          if (!avail.length) return toast('No active sales admins');
          modal.open({
            title: 'Assign To',
            fields: [{ key: 'who', label: 'Team member', type: 'select', options: avail.map((m) => ({ value: m.id, label: m.name })), required: true, default: a.assignedTo || '' }],
            onSubmit: async (v) => {
              await updateAcquisition(a.id, { assignedTo: String(v.who) });
              void q.refetch();
              toast('👤 Assigned to ' + (nameOf(String(v.who)) || 'team member'));
            },
          });
        }),
        btn('⚑ Priority: ' + statusLabel(a.priority), () =>
          modal.open({
            title: 'Priority',
            fields: [{ key: 'p', label: 'Priority', type: 'select', options: ['urgent', 'high', 'normal'].map((v) => ({ value: v, label: statusLabel(v) })), default: a.priority, required: true }],
            onSubmit: async (v) => {
              await updateAcquisition(a.id, { priority: String(v.p) });
              void q.refetch();
              toast('⚑ Priority set to ' + v.p);
            },
          })),
      ]}
      banners={[
        lock,
        stageBanner ? { text: 'Stage updated to ' + stageBanner, tone: 'info', actions: [{ label: 'Send WhatsApp to Seller', onClick: () => msgSeller('whatsapp', 'Hi ' + first + ', an update on ' + a.title + ': it has moved to ' + stageBanner + '.') }], dismiss: () => setStageBanner(null) } : null,
      ]}
      steps={stage === 'rejected' ? [] : FLOW}
      currentStep={current}
      stepsDim={stage === 'on_hold'}
      stepNote={stage === 'on_hold' ? { text: '⏸ On Hold', tone: 'orange' } : stage === 'acquired' ? { text: '🏠 Acquired', tone: 'green' } : null}
      main={stage === 'rejected' ? [{ title: 'Rejected', banners: [{ text: '❌ Rejected — ' + (a.rejectionReason || 'No reason recorded'), tone: 'error' }] }, ...main] : main}
      side={[
        personSection('Seller · Property Owner', { name: a.sellerName, phone: a.sellerPhone, email: a.sellerEmail }, [{ label: 'City', value: a.city }], a.sellerId ? '/admin/users/' + a.sellerId : null, 'View Seller Profile →', navigate),
        {
          title: 'Property',
          cols: 1,
          fields: [
            { label: 'Type', value: typeLabel(a.type) },
            { label: 'Location', value: a.location },
            { label: 'Asking', value: price(a.askingPrice), strong: true },
            { label: 'BG Offer', value: offerAmt ? price(offerAmt) : '—', color: '#15803d' },
            { label: 'Agreed', value: a.agreedPrice ? price(a.agreedPrice) : '—', color: '#15803d' },
          ],
          actions: a.propertyId ? [btn('View Property →', () => navigate('/admin/properties/' + a.propertyId), 'link')] : a.sellRequestId ? [btn('View Sell Request →', () => navigate('/admin/enquiries/sell/' + a.sellRequestId), 'link')] : [],
        },
        ['acquired', 'rejected', 'on_hold'].includes(stage) ? null : { title: 'Actions', stack: true, actions: [btn('⏸️ Put On Hold', hold), btn('❌ Reject', () => reject(), 'red')] },
        wf.activity(),
        wf.sent(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
