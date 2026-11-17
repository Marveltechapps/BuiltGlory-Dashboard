import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { checksDone, checksSection } from '../../../components/detail/checks';
import { detailStateOf } from '../../../components/detail/detailState';
import { BUYER_LEGAL, legalSection, type LegalState } from '../../../components/detail/legalChecklist';
import { methodLabel, PAY_METHODS, payForm, payValid, printReceipt } from '../../../components/detail/payment';
import { btn, personSection, propertySection } from '../../../components/detail/sections';
import { useFormModal, type FormValues } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { SLOTS } from '../../../constants/enquiries';
import { SALES_STAGES } from '../../../constants/labels';
import { STAGE_DOT } from '../../../constants/pipeline';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useProperty } from '../../../hooks/useProperty';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useDesigners, useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { callPhone } from '../../../lib/contact';
import { addDaysIso, badge, date, price, relativeLong, salesStage, shortId, statusLabel, time12, todayIso } from '../../../lib/format';
import { arr, asRaw, num, str, type Raw } from '../../../lib/raw';
import { listVisits, submitVisitFeedback, updateVisitStatus } from '../../../services/enquiries';
import { findProperties, updateProperty, updatePropertyStatus } from '../../../services/properties';
import {
  closeDeal, createSalesDeal, getSalesDeal, listDealRecommendations, listPayments, markDealLost, updateDealOffer, updateDealPaymentPlan,
  updateDealStage, updateDealTokenPayment, updateSalesDeal, verifyPayment,
} from '../../../services/sales';
import { createLog, uploadProof } from '../../../services/workflow';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import type { SectionSpec } from '../../../types/detail';

const FLOW = [
  { value: 'active_leads', label: 'Active Leads' }, { value: 'site_visits', label: 'Site Visits' }, { value: 'negotiation', label: 'Negotiation' },
  { value: 'token_payment', label: 'Token Payment' }, { value: 'payment', label: 'Payment' }, { value: 'interior_design', label: 'Interior Design' },
  { value: 'documentation', label: 'Documentation' }, { value: 'closed', label: 'Closed' },
];
const STAGE_NEXT: Record<string, string[]> = {
  active_leads: ['site_visits'],
  site_visits: ['negotiation'],
  negotiation: ['token_payment'],
  token_payment: ['full_payment', 'stage_payment'],
  full_payment: ['documentation'],
  stage_payment: ['interior_design', 'documentation'],
  interior_design: ['documentation'],
  documentation: ['closed'],
  lost: ['re_engagement'],
  re_engagement: ['active_leads'],
};
const LOST_FROM = new Set(['active_leads', 'site_visits', 'negotiation']);
const TAB: Record<string, string> = { active_leads: 'leads', site_visits: 'visits', negotiation: 'negotiation', token_payment: 'token', full_payment: 'fullpayment', stage_payment: 'stagepayment', interior_design: 'interior', documentation: 'documentation', closed: 'closed', lost: 'lost', re_engagement: 'reengagement' };
const PRE = ['Confirm visit time with buyer', 'Share location / meeting link', 'Keys / access arranged', 'Brochure & price sheet ready'];
const HANDOVER = ['Keys handed over', 'Meter readings recorded', 'Society NOC shared', 'Possession letter signed'];
const CHARGES = ['GST (5%)', 'Khata Transfer Fee', 'Betterment Charges', 'Society Transfer Fee', 'NOC Charges', 'Franking Charges', 'Maintenance Deposit', 'Electricity Deposit', 'Water / BWSSB Deposit', 'Brokerage / Agent Fee', 'Infrastructure / Development Charge', 'Club Membership Fee', 'Car Parking Charge', 'Floor Rise Premium', 'Facing / View Premium', 'Other Property Cost'];
const MS_ST: Record<string, [string, string]> = { pending: ['⏳ Pending', 'muted'], in_progress: ['🔄 In Progress', 'blue'], paid: ['✅ Paid', 'green'], overdue: ['⚠️ Overdue', 'red'], proof_pending: ['Buyer proof pending verification', 'amber'] };
const LOST_REASONS = ['Budget constraints', 'Bought elsewhere', 'Loan not approved', 'Not interested', 'Price disagreement', 'Other'];
const RE_REASONS = ['Price reduced on property', 'New similar property available', "Buyer's situation changed", 'Follow-up after cooling period', 'Special offer/discount', 'Other'];
const FEEDBACK_INTEREST: Array<[string, string]> = [['very_interested', 'Very Interested'], ['interested', 'Interested'], ['needs_time', 'Needs Time'], ['not_interested', 'Not Interested']];
const FEEDBACK_NEXT: Array<[string, string]> = [['move_to_negotiation', 'Move to negotiation'], ['schedule_another_visit', 'Schedule another visit'], ['follow_up', 'Follow up later'], ['mark_lost', 'Close']];

interface Charge {
  name: string;
  amount: number;
  group: 'prop' | 'reg' | 'other';
}

export function SalesDealDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['sales-deal', id], queryFn: ({ signal }) => getSalesDeal(id, signal), retry: false });
  const d = q.data;
  const prop = useProperty(d?.propertyId);
  const { team, nameOf } = useSalesTeam();
  const { designers } = useDesigners();
  const wf = useWorkflowSections('sales_deal', id, f, d?.createdAt);
  const lock = useEditLock('sales_deal', id);
  const paymentsQ = useQuery({ queryKey: ['payments', id], queryFn: ({ signal }) => listPayments({ dealId: id }, signal), enabled: !!d && d.stage === 'token_payment', retry: false });
  const visitsQ = useQuery({ queryKey: ['visits'], queryFn: ({ signal }) => listVisits(signal), enabled: !!d && d.stage === 'site_visits', retry: false });
  const recsQ = useQuery({ queryKey: ['deal-recs', id], queryFn: ({ signal }) => listDealRecommendations(id, signal), enabled: !!d && d.stage === 're_engagement', retry: false });
  const availQ = useQuery({ queryKey: ['available-props'], queryFn: ({ signal }) => findProperties({ status: 'available', limit: 20 }, signal), enabled: !!d && d.stage === 'lost', retry: false });
  const run = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['sales-deal', id], ['sales-deals'], ['payments', id]]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !d) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/sales/all" />;

  const today = todayIso();
  const stage = d.stage;
  const label = salesStage(stage);
  const agreed = d.agreedPrice || 0;
  const idx = stage === 'full_payment' || stage === 'stage_payment' ? 4 : FLOW.findIndex((x) => x.value === stage);
  const first = d.buyerName.split(' ')[0];
  const entity = { type: 'sales_deal' as const, id: d.id };
  const doc = d.documentation;
  const wfd = asRaw(doc.workflow);
  const tp = d.tokenPayment;
  const tokenAmount = d.tokenPaid ? d.tokenAmount ?? num(tp.amount) ?? 0 : 0;
  const totalPaid = Math.max(d.totalPaid, tokenAmount);
  const assigned = nameOf(d.assignedTo, d.assignedName) || d.assignedName;
  const days = d.daysInStage;
  const p = prop.data;

  const exec = (fn: () => Promise<unknown>, msg?: string) => run.mutateAsync(fn).then(() => { if (msg) toast(msg); });
  const move = (to: string, extra: Raw = {}, msg?: string) =>
    exec(() => updateDealStage(d.id, to, extra)).then(() => {
      setStageBanner(salesStage(to));
      toast(msg || 'Stage updated to ' + salesStage(to));
    });
  const suggestedToken = agreed ? Math.round((agreed * 0.05) / 1e4) * 1e4 : 0;
  const tokenFields = () => [
    { key: 'amount', label: 'Token amount (₹)', type: 'number' as const, default: suggestedToken ? String(suggestedToken) : '' },
    { key: 'method', label: 'Payment method', type: 'select' as const, options: PAY_METHODS },
    { key: 'reference', label: 'UTR / Reference number' },
    { key: 'date', label: 'Payment date', type: 'date' as const, max: today, default: today },
  ];
  const tokenErrors = (v: FormValues) => {
    const err: Record<string, string> = {};
    if (!(Number(v.amount) > 0)) err.amount = 'Token cannot be 0';
    if (!v.method) err.method = 'Payment method is required';
    if (v.method && v.method !== 'cash' && !String(v.reference || '').trim()) err.reference = 'UTR / Reference number is required';
    if (!v.date) err.date = 'Payment date is required';
    else if (String(v.date) > today) err.date = 'Payment date is in the future';
    return err;
  };
  const tokenBody = (v: FormValues) => {
    const method = String(v.method) as 'neft' | 'upi' | 'cheque' | 'cash';
    const amount = Number(v.amount);
    return { tokenAmount: amount, tokenPaid: true, tokenPayment: { amount, method, paymentDate: String(v.date), reference: String(v.reference || (method === 'cash' ? 'Cash' : '')) } };
  };
  const finishMove = async (to: string) => {
    await updateDealStage(d.id, to);
    setStageBanner(salesStage(to));
    toast('Stage updated to ' + salesStage(to));
    void q.refetch();
  };
  const recordTokenAndMove = (to: string) =>
    modal.open({
      title: 'Record token payment',
      subtitle: d.buyerName + ' · ' + d.propertyTitle,
      banners: [{ text: 'The token is saved on this deal, then the stage moves to ' + salesStage(to) + '.', tone: 'info' }],
      fields: tokenFields(),
      validate: tokenErrors,
      submit: 'Record & move',
      onSubmit: async (v) => {
        await updateDealTokenPayment(d.id, tokenBody(v));
        await finishMove(to);
      },
    });
  const saveWf = (patch: Raw, msg?: string) => exec(() => updateSalesDeal(d.id, { documentation: { ...doc, workflow: { ...wfd, ...patch } } }), msg);
  const plan = (body: Raw, msg?: string) => exec(() => updateDealPaymentPlan(d.id, body), msg);
  const msg = (ch: 'whatsapp' | 'email', body?: string, extra: { onSent?: () => void } = {}) =>
    openCompose({ channel: ch, name: d.buyerName, to: ch === 'email' ? d.buyerEmail : d.buyerPhone, entity, property: d.propertyTitle, body, onSent: extra.onSent });
  const next = (actions: SectionSpec['actions'], note?: SectionSpec['banners']): SectionSpec => ({ key: 'next', title: 'Next Step', tone: 'next', stack: true, banners: note || [], actions });
  const lose = (title?: string) =>
    modal.open({
      title: title || '❌ Mark as Lost',
      fields: [{ key: 'reason', label: 'Select reason', type: 'select', options: LOST_REASONS, required: true, reqMsg: 'Select a reason' }, { key: 'notes', label: 'Notes', type: 'textarea', required: true }],
      submit: 'Mark as Lost',
      tone: 'destructive',
      onSubmit: async (v) => {
        await markDealLost(d.id, { lostReason: String(v.reason), notes: String(v.notes) });
        await updateSalesDeal(d.id, { documentation: { ...doc, workflow: { ...wfd, lostAtStage: stage, lostAt: new Date().toISOString(), lostNotes: String(v.notes) } } });
        void q.refetch();
        setStageBanner(salesStage('lost'));
        toast('Deal marked as lost');
      },
    });
  const scheduleVisit = (after?: () => Promise<unknown>) =>
    modal.open({
      title: 'Schedule Visit',
      subtitle: d.buyerName + ' · ' + d.propertyTitle,
      formCols: 2,
      banners: [{ text: 'Visit bookings are created from the buyer app (POST /visits is customer-only). This records the agreed slot on the deal timeline.', tone: 'muted' }],
      fields: [
        { key: 'date', label: 'Visit date', type: 'date', required: true, min: today },
        { key: 'time', label: 'Visit time', type: 'select', options: SLOTS, required: true, default: '10:00 AM' },
        { key: 'type', label: 'Visit type', type: 'select', options: ['Physical', 'Virtual'], default: 'Physical' },
        { key: 'link', label: 'Meeting link', placeholder: 'Add meeting link for virtual visit', full: true },
      ],
      validate: (v) => ({ date: String(v.date) < today ? 'Date is in the past' : '', link: !v.link || /^https:\/\//.test(String(v.link)) ? '' : 'URL must start with https://' }),
      submit: 'Confirm Visit',
      onSubmit: async (v) => {
        await createLog('sales_deal', d.id, { channel: 'note', direction: 'internal', summary: 'Visit agreed for ' + date(v.date + 'T12:00:00') + ', ' + v.time + ' (' + v.type + ')', body: v.link ? 'Meeting link: ' + v.link : null });
        await saveWf({ plannedVisit: { date: v.date, time: v.time, type: v.type, link: v.link || '' } });
        if (after) await after();
        void wf.logsQ.refetch();
        toast('📅 Visit scheduled for ' + date(v.date + 'T12:00:00'));
      },
    });

  const main: Array<SectionSpec | null> = [];
  const offers = arr(wfd.offers).map((o) => asRaw(o));

  if (stage === 'active_leads') {
    const ql = wfd.qualification ? asRaw(wfd.qualification) : null;
    const editing = !ql || f.val<boolean>('q.edit', false);
    main.push(
      {
        title: 'Buyer Enquiry',
        fields: [{ label: 'Source', value: d.sourceEnquiryId ? 'Buy enquiry' : 'Via App' }, { label: 'Listed price', value: price(d.listedPrice) }],
        banners: [days > 14 ? { text: 'Stale Lead 🔴 — no movement in ' + days + ' days', tone: 'error', action: { label: 'Mark as Lost', onClick: () => lose() } } : days > 5 ? { text: 'Follow up needed', tone: 'warn' } : null],
        actions: d.sourceEnquiryId ? [btn('View Original Enquiry →', () => navigate('/admin/enquiries/buy/' + d.sourceEnquiryId), 'link')] : [],
      },
      !editing && ql
        ? {
            title: 'Lead Qualification',
            fields: [
              { label: 'Buyer intent', value: str(ql.intent), strong: true },
              { label: 'Budget', value: (num(ql.min) ? price(num(ql.min)) : '—') + ' – ' + (num(ql.max) ? price(num(ql.max)) : '—') },
              { label: 'Timeline', value: str(ql.timeline) },
              { label: 'Financing', value: str(ql.financing) },
            ],
            text: str(ql.notes),
            banners: [str(ql.intent) === 'Just Browsing' ? { text: 'Consider marking as lost — buyer may not be ready to purchase.', tone: 'warn' } : null, num(ql.max) && (num(ql.max) ?? 0) < d.listedPrice ? { text: 'Budget below listed price', tone: 'warn' } : null],
            actions: [btn('Edit', () => f.set('q.edit', true))],
          }
        : {
            title: 'Lead Qualification',
            form: [
              f.inp('q.intent', 'Buyer intent', { type: 'select', options: ['Very Interested', 'Interested', 'Needs Time', 'Just Browsing'], required: true, default: str(ql?.intent) }),
              f.inp('q.min', 'Budget Min (₹)', { type: 'number', default: ql && num(ql.min) ? String(num(ql.min)) : '' }),
              f.inp('q.max', 'Budget Max (₹)', { type: 'number', hint: "Buyer's stated budget", default: ql && num(ql.max) ? String(num(ql.max)) : '' }),
              f.inp('q.time', 'Timeline', { type: 'select', options: ['Immediate', 'Within 1 month', '1–3 months', '3–6 months', '6+ months'], placeholder: 'Select timeline', required: true, default: str(ql?.timeline) }),
              f.inp('q.fin', 'Financing', { type: 'select', options: ['Self-funded', 'Home loan', 'Loan pre-approved', 'NRI remittance'], default: str(ql?.financing) }),
              f.inp('q.notes', 'Notes', { type: 'textarea', default: str(ql?.notes) }),
            ],
            banners: Number(f.str('q.max')) && Number(f.str('q.max')) < d.listedPrice ? [{ text: 'Budget below listed price', tone: 'warn' }] : [],
            actions: [
              btn('Save Qualification', () => {
                const dq = { 'q.intent': str(ql?.intent), 'q.time': str(ql?.timeline) };
                if (!f.need({ 'q.intent': 'Buyer intent is required', 'q.time': 'Timeline is required' }, dq)) return;
                void saveWf(
                  { qualification: { intent: f.str('q.intent', dq['q.intent']), min: Number(f.str('q.min', ql && num(ql.min) ? String(num(ql.min)) : '')) || 0, max: Number(f.str('q.max', ql && num(ql.max) ? String(num(ql.max)) : '')) || 0, timeline: f.str('q.time', dq['q.time']), financing: f.str('q.fin', str(ql?.financing)), notes: f.str('q.notes', str(ql?.notes)) } },
                  '✅ Qualification saved',
                ).then(() => f.clear('q.'));
              }, 'primary'),
            ],
          },
      next([
        btn('📅 Schedule Site Visit', () => scheduleVisit(() => updateDealStage(d.id, 'site_visits', {}).then(() => setStageBanner(salesStage('site_visits'))).then(() => q.refetch())), 'green'),
        btn('📤 Send Property Details (WhatsApp)', () => msg('whatsapp', 'Hi ' + first + ', details for ' + d.propertyTitle + ': ' + price(d.listedPrice) + ', ' + d.propertyLocation + '.')),
        btn('📤 Send Property Details (Email)', () => msg('email')),
        btn('👎 Mark as Not Interested', () => askConfirm({ title: 'Mark as not interested?', message: 'Mark this lead as not interested and move to Lost?', confirmLabel: 'Move to Lost', tone: 'destructive', onConfirm: () => exec(() => markDealLost(d.id, { lostReason: 'Not interested' }), 'Deal marked as lost') }), 'red'),
      ]),
    );
  }

  if (stage === 'site_visits') {
    const visit = (visitsQ.data?.items ?? []).filter((v) => v.buyerId === d.buyerId && v.propertyId === d.propertyId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const passed = visit && visit.visitDate < today && ['scheduled', 'confirmed', 'rescheduled'].includes(visit.status);
    const done = visit && visit.status === 'completed';
    const preState = asRaw(wfd.preVisit);
    const preDone = checksDone(PRE, preState);
    const setV = (s: 'completed' | 'missed' | 'cancelled', extra: Raw = {}) => {
      if (s === 'completed') {
        const saved = visit?.feedback;
        if (!saved?.buyerInterest || !saved.notes || !saved.nextAction) return toast('Add feedback before marking this visit completed.');
        extra = { ...extra, feedback: { buyerInterest: saved.buyerInterest, notes: saved.notes, nextAction: saved.nextAction } };
      }
      return exec(() => updateVisitStatus(visit!.id, { status: s, ...extra }), 'Visit marked ' + s).then(() => visitsQ.refetch());
    };
    const planned = wfd.plannedVisit ? asRaw(wfd.plannedVisit) : null;
    main.push(
      visit
        ? {
            title: 'Scheduled Visit',
            fields: [
              { label: 'Date', value: date(visit.visitDate + 'T12:00:00'), strong: true },
              { label: 'Time', value: time12(visit.visitTime) },
              { label: 'Type', value: statusLabel(visit.visitType) },
              { label: visit.visitType === 'virtual' ? 'Meeting link' : 'Property address', value: visit.visitType === 'virtual' ? visit.meetingLink || 'No meeting link added' : visit.propertyAddress },
              { label: 'Assigned:', value: nameOf(visit.assignedTo, visit.assignedName) || visit.assignedName },
              { label: 'Status', value: statusLabel(visit.status) },
            ],
            banners: passed ? [{ text: '⚠️ Visit time has passed', tone: 'warn', action: { label: 'Mark Completed', onClick: () => void setV('completed') } }] : [],
            actions: [
              btn(visit.visitType === 'virtual' ? 'Join Call' : 'Get Directions', () => {
                if (visit.visitType === 'virtual') return visit.meetingLink ? void window.open(visit.meetingLink, '_blank', 'noopener,noreferrer') : toast('⚠️ No meeting link added');
                window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(visit.propertyTitle + ' ' + visit.propertyAddress), '_blank', 'noopener,noreferrer');
              }),
              btn('Open visit →', () => navigate('/admin/visits/' + visit.id), 'link'),
            ],
          }
        : {
            title: 'Scheduled Visit',
            fields: planned ? [{ label: 'Agreed slot', value: date(str(planned.date) + 'T12:00:00') + ', ' + str(planned.time) }, { label: 'Type', value: str(planned.type) }] : [],
            empty: visitsQ.isPending ? 'Loading visit…' : planned ? '' : 'No visit scheduled yet',
            actions: [btn('📅 Schedule Visit', () => scheduleVisit(), 'primary')],
          },
      { ...checksSection('Pre-Visit Checklist', PRE, preState, (s) => void saveWf({ preVisit: s })), banners: preDone < PRE.length && !done ? [{ text: 'Pre-visit checklist incomplete — complete before the visit.', tone: 'warn' }] : [] },
      !visit || (!done && !visit.feedback)
        ? { title: 'Post-Visit Feedback', banners: [{ text: '🔒 Complete visit to add feedback', tone: 'muted' }] }
        : visit.feedback && !f.val<boolean>('fb.edit', false)
          ? {
              title: 'Post-Visit Feedback',
              fields: [{ label: 'Buyer interest', value: statusLabel(visit.feedback.buyerInterest) }, { label: 'Next action', value: FEEDBACK_NEXT.find(([k]) => k === visit.feedback!.nextAction)?.[1] ?? statusLabel(visit.feedback.nextAction) }],
              text: visit.feedback.notes,
              banners: visit.feedback.buyerInterest === 'not_interested' ? [{ text: 'Consider marking as lost', tone: 'warn' }] : [],
              actions: [btn('Edit', () => f.set('fb.edit', true))],
            }
          : {
              title: 'Post-Visit Feedback',
              form: [
                f.inp('fb.int', 'Buyer interest', { type: 'select', options: FEEDBACK_INTEREST.map(([value, l]) => ({ value, label: l })), required: true }),
                f.inp('fb.next', 'Next action', { type: 'select', options: FEEDBACK_NEXT.map(([value, l]) => ({ value, label: l })), required: true }),
                f.inp('fb.notes', 'Notes', { type: 'textarea', required: true }),
              ],
              actions: [
                btn('Save Feedback', () => {
                  if (!f.need({ 'fb.int': 'Buyer interest is required', 'fb.next': 'Next action is required', 'fb.notes': 'Notes are required' })) return;
                  void exec(() => submitVisitFeedback(visit.id, { feedback: { buyerInterest: f.str('fb.int'), nextAction: f.str('fb.next'), notes: f.str('fb.notes') } }), '✅ Feedback saved').then(() => { f.clear('fb.'); void visitsQ.refetch(); });
                }, 'primary'),
              ],
            },
      next([
        btn('💬 Move to Negotiation', () => void move('negotiation'), 'green'),
        btn('📅 Set Follow-up Reminder', () =>
          modal.open({ title: 'Set Follow-up Reminder', fields: [{ key: 'date', label: 'Remind on', type: 'date', min: today, required: true }], onSubmit: (v) => saveWf({ followUp: String(v.date) }, '📅 Reminder set') })),
        btn('Schedule another visit', () => scheduleVisit()),
        visit ? btn('🔄 Reschedule Visit', () => navigate('/admin/visits/' + visit.id)) : null,
        visit && visit.status !== 'cancelled'
          ? btn('❌ Cancel Visit', () => askConfirm({ title: 'Cancel visit?', input: { label: 'Cancellation reason', required: true }, confirmLabel: 'Confirm Cancel', tone: 'destructive', onConfirm: ({ value }) => setV('cancelled', { cancelReason: value, reason: value }) }), 'red')
          : null,
        btn('Mark as Lost', () => lose(), 'red'),
      ]),
    );
  }

  if (stage === 'negotiation') {
    const last = offers[offers.length - 1];
    const lastAmt = num(last?.amount) ?? 0;
    const dl = str(wfd.deadline);
    const expired = last && last.by === 'Buyer' && last.offeredAt && Date.now() - Date.parse(str(last.offeredAt)) > 72 * 36e5;
    const saveOffers = (list: Raw[], msgText?: string, offered?: number) =>
      exec(async () => {
        await updateSalesDeal(d.id, { documentation: { ...doc, workflow: { ...wfd, offers: list } } });
        if (offered) await updateDealOffer(d.id, { offeredPrice: offered });
      }, msgText);
    const confirm = () =>
      modal.open({
        title: 'Confirm Deal',
        fields: [{ key: 'price', label: 'Final price (₹)', type: 'number', required: true, default: String(lastAmt || d.offeredPrice || d.listedPrice) }, { key: 'mgmt', label: 'Management approved', type: 'checkbox' }],
        validate: (v) => ({ mgmt: Number(v.price) < d.listedPrice * 0.9 && !v.mgmt ? 'Discount over 10% — management approval required' : '' }),
        submit: '✅ Deal Agreed — Collect Token',
        tone: 'green',
        onSubmit: async (v) => {
          await updateDealOffer(d.id, { agreedPrice: Number(v.price) });
          await move('token_payment', { agreedPrice: Number(v.price) }, '🎉 Deal agreed at ' + price(Number(v.price)));
        },
      });
    main.push(
      {
        title: 'Price Negotiation',
        cols: 3,
        fields: [
          { label: 'Listed', value: price(d.listedPrice), strong: true },
          { label: 'Buyer offer', value: last ? price(lastAmt) : d.offeredPrice ? price(d.offeredPrice) : '—', strong: true, color: '#c2410c' },
          { label: 'Gap', value: last ? price(d.listedPrice - lastAmt) : '—' },
        ],
        banners: [
          last && lastAmt > d.listedPrice ? { text: 'Buyer offering above listed price!', tone: 'success' } : null,
          last && lastAmt < d.listedPrice * 0.85 ? { text: 'Below market rate — buyer offer is more than 15% under listed price', tone: 'warn' } : null,
          expired ? { text: 'Buyer counter offer expired (72hrs)', tone: 'error', action: { label: 'Send Reminder', onClick: () => msg('whatsapp', 'Hi ' + first + ', following up on your offer for ' + d.propertyTitle + '.') } } : null,
        ],
        rows: offers.map((o, i) => ({
          key: String(i),
          title: price(num(o.amount)) + ' · ' + str(o.by),
          sub: (str(o.notes) || '') + (o.offeredAt ? ' · ' + relativeLong(str(o.offeredAt)) : ''),
          badges: [badge(statusLabel(str(o.status, 'active')), str(o.status) === 'rejected' ? 'red' : str(o.status) === 'countered' ? 'purple' : str(o.status) === 'accepted' ? 'green' : 'orange')],
          actions:
            o.by === 'Buyer' && o.status === 'active'
              ? [
                  { label: 'Accept', variant: 'green', onClick: confirm },
                  { label: 'Counter', onClick: () => f.set('o.amt', String(Math.round(((num(o.amount) ?? 0) + d.listedPrice) / 2 / 1e4) * 1e4)) },
                  { label: 'Decline', variant: 'red', onClick: () => void saveOffers(offers.map((x, j) => (j === i ? { ...x, status: 'rejected' } : x)), 'Offer declined') },
                ]
              : [],
        })),
        empty: offers.length ? '' : 'No offers yet',
        form: [f.inp('o.amt', 'Counter offer (₹)', { type: 'number' }), f.inp('o.by', 'Offered by', { type: 'select', options: ['Builtglory', 'Buyer'], default: 'Builtglory' }), f.inp('o.notes', 'Message with offer')],
        actions: [
          btn('Make offer', () => {
            const amt = Number(f.str('o.amt'));
            if (!(amt > 0)) return void f.fail('o.amt', 'Enter a valid amount');
            const by = f.str('o.by', 'Builtglory');
            const list = offers.map((x) => (x.status === 'active' ? { ...x, status: 'countered' } : x)).concat([{ amount: amt, by, status: 'active', notes: f.str('o.notes'), offeredAt: new Date().toISOString() }]);
            void saveOffers(list, by === 'Buyer' ? '💰 Buyer offer recorded' : '💰 Counter offer sent', by === 'Buyer' ? amt : undefined).then(() => f.clear('o.'));
          }, 'primary'),
          btn('⬆️ Escalate', () => void exec(() => createLog('sales_deal', d.id, { channel: 'note', direction: 'internal', summary: 'Negotiation escalated to Sales Manager' }), '⬆️ Escalated to Sales Manager')),
        ],
      },
      {
        title: 'Negotiation Deadline',
        fields: [{ label: 'Deadline', value: dl ? date(dl + 'T12:00:00') + (dl < today ? ' · OVERDUE' : '') : 'Not set', color: dl && dl < today ? '#dc2626' : '#0f172a' }],
        banners: dl && dl < today ? [{ text: '⚠️ Deadline passed', tone: 'error' }] : [],
        form: [f.inp('dl', 'Set Deadline', { type: 'date', min: today })],
        actions: [
          btn(dl ? 'Change' : '+ Set Deadline', () => {
            if (!f.str('dl')) return void f.fail('dl', 'Pick a date');
            void saveWf({ deadline: f.str('dl') }, '⏱ Deadline set').then(() => f.set('dl', ''));
          }),
          dl ? btn('Remove', () => void saveWf({ deadline: null }), 'red') : null,
        ],
      },
      { title: 'Send Offer', actions: [btn('💬 WhatsApp', () => msg('whatsapp', 'Hi ' + first + ', our best price for ' + d.propertyTitle + ' is ' + price(d.listedPrice) + '.'), 'green'), btn('📧 Email', () => msg('email'))] },
      next([btn('🤝 Confirm Deal', confirm, 'green'), btn('❌ Mark as Lost', () => lose(), 'red')]),
    );
  }

  if (stage === 'token_payment') {
    if (!agreed) {
      main.push({
        title: 'Deal Confirmed',
        banners: [{ text: 'No agreed price set. Token payment cannot move back to Negotiation.', tone: 'error' }],
        actions: [btn('Save agreed price', () => modal.open({
          title: 'Agreed price',
          fields: [{ key: 'price', label: 'Agreed price (₹)', type: 'number', required: true, default: String(d.offeredPrice || d.listedPrice || '') }],
          submit: 'Save',
          onSubmit: (v) => exec(() => updateDealOffer(d.id, { agreedPrice: Number(v.price) }), 'Agreed price saved'),
        }), 'primary')],
      });
    } else {
      const suggested = Math.round((agreed * 0.05) / 1e4) * 1e4;
      const subs = (paymentsQ.data ?? []).filter((x) => x.type === 'token');
      const recordedToken = d.tokenPaid && num(tp.amount) != null;
      const rows: Array<[string, string]> = [
        ['Receipt No', 'TK-' + shortId(d.id, d.referenceId)],
        ['Date', date(str(tp.paymentDate))],
        ['Buyer', d.buyerName],
        ['Property', d.propertyTitle],
        ['Listed Price', price(d.listedPrice)],
        ['Agreed Price', price(agreed)],
        ['Token Amount', price(tokenAmount)],
        ['Method', methodLabel(tp.method)],
        ['Reference', str(tp.reference)],
      ];
      main.push(
        { title: '🎉 Deal Agreed!', subtitle: 'Deal Confirmed', cols: 3, fields: [{ label: 'Listed', value: price(d.listedPrice) }, { label: 'Agreed', value: price(agreed), strong: true, color: '#15803d' }, { label: 'Savings', value: price(Math.max(0, d.listedPrice - agreed)), color: '#15803d' }] },
        {
          title: 'Buyer payment submissions',
          banners: [{ text: 'Bank transfers and in-person payments stay pending until you verify them. Do not mark paid until the money or office receipt is confirmed.', tone: 'info' }],
          rows: subs.map((s) => ({
            key: s.id,
            title: price(s.amount) + ' · ' + methodLabel(s.method),
            sub: 'Reference ' + (s.transactionReference || '—') + ' · ' + (s.proofUrl ? 'Payment proof attached' : 'No proof uploaded'),
            badges: [badge(statusLabel(s.status), s.status === 'paid' ? 'green' : s.status === 'rejected' || s.status === 'failed' ? 'red' : 'amber')],
            actions:
              s.status === 'pending' || s.status === 'created'
                ? [
                    s.proofUrl ? { label: 'View proof', onClick: () => void window.open(s.proofUrl, '_blank', 'noopener,noreferrer') } : null,
                    {
                      label: 'Verify',
                      variant: 'green',
                      onClick: () =>
                        void exec(async () => {
                          await verifyPayment(s.id, { decision: 'paid' });
                          await updateDealTokenPayment(d.id, { tokenAmount: s.amount, tokenPaid: true });
                        }, '✅ Token verified'),
                    },
                    { label: 'Reject', variant: 'red', onClick: () => askConfirm({ title: 'Reject submission?', input: { label: 'Verification notes or rejection reason', required: true }, confirmLabel: 'Reject', tone: 'destructive', onConfirm: ({ value }) => exec(() => verifyPayment(s.id, { decision: 'rejected', notes: value }), 'Submission rejected') }) },
                  ]
                : [],
          })),
          empty: subs.length ? '' : paymentsQ.isPending ? 'Loading submissions…' : 'No buyer submission yet…',
        },
        recordedToken || d.tokenPaid
          ? {
              title: 'Token Receipt',
              fields: rows.map(([l, v]) => ({ label: l, value: v, strong: l === 'Token Amount' })),
              actions: [
                btn('📥 Download', () => printReceipt('Token Receipt', rows)),
                btn('Send to Buyer', () => msg('whatsapp', 'Token receipt: ' + price(tokenAmount) + ' received for ' + d.propertyTitle + '. Ref ' + str(tp.reference) + '.')),
                btn('Update', () => void exec(() => updateDealTokenPayment(d.id, { tokenPaid: false, tokenPayment: null }))),
              ],
            }
          : {
              title: 'Record in-person / office payment',
              form: [...payForm(f, 't.', today, { amountLabel: 'Token amount (₹)', amount: suggested }), f.inp('t.partial', 'Partial payment received', { type: 'checkbox' })],
              banners: [Number(f.str('t.amount', String(suggested))) > agreed * 0.2 ? { text: 'Token is unusually high', tone: 'warn' } : null, f.val<boolean>('t.partial', false) ? { text: 'Partial Payment — Full token required before proceeding to next stage', tone: 'warn' } : null],
              actions: [
                btn('Record Payment', () => {
                  const pay = payValid(f, 't.', today, { amount: suggested }, { zeroMsg: 'Token cannot be 0' });
                  if (!pay) return;
                  const partial = f.val<boolean>('t.partial', false);
                  void exec(() => updateDealTokenPayment(d.id, { tokenAmount: pay.amount, tokenPaid: !partial, tokenPayment: { ...pay, notes: partial ? 'Partial token payment' : '' } }), '✅ Token payment recorded').then(() => f.clear('t.'));
                }, 'primary'),
              ],
            },
        {
          title: 'Choose Payment Method',
          subtitle: 'How will buyer pay the balance?',
          chips: [['full', 'Full Payment — Pay entire balance at once'], ['stage', 'Stage Payment — Pay in milestones']].map(([k, l]) => ({
            label: l!,
            on: d.paymentType === k,
            onClick: () => void plan({ paymentType: k }, k === 'full' ? 'Full Payment selected' : 'Stage Payment selected'),
          })),
        },
        next(
          [
            btn(d.paymentType === 'stage' ? '📊 Move to Stage Payment' : '💳 Move to Full Payment', () => {
              if (!d.paymentType) return toast('Select payment method first');
              const to = d.paymentType === 'stage' ? 'stage_payment' : 'full_payment';
              if (!d.tokenPaid) return recordTokenAndMove(to);
              void move(to);
            }, 'green', { disabled: !d.paymentType }),
          ],
          !d.paymentType ? [{ text: 'Select payment method first', tone: 'muted' }] : !d.tokenPaid ? [{ text: 'Record the token payment to continue. Moving will save it on this deal.', tone: 'muted' }] : [],
        ),
      );
    }
  }

  if (stage === 'full_payment') {
    const fp = d.fullPayment;
    const charges: Charge[] = arr(fp.charges).length
      ? arr(fp.charges).map((c) => { const x = asRaw(c); return { name: str(x.name), amount: num(x.amount) ?? 0, group: (str(x.group, 'other') as Charge['group']) }; })
      : [{ name: 'Stamp Duty (5.6%)', amount: Math.round(agreed * 0.056), group: 'reg' }, { name: 'Registration Fee (1%)', amount: Math.round(agreed * 0.01), group: 'reg' }];
    const sub = (g: Charge['group']) => charges.filter((x) => x.group === g).reduce((t, x) => t + x.amount, 0);
    const total = agreed + sub('prop') + sub('reg') + sub('other');
    const bal = total - totalPaid;
    const fullRec = fp.payment ? asRaw(fp.payment) : null;
    const saveCharges = (list: Charge[], m?: string) => plan({ paymentType: 'full', fullPayment: { ...fp, charges: list } }, m);
    const addCharge = (group: Charge['group']) => {
      const n = f.str('ch.' + group + '.name');
      const amt = Number(f.str('ch.' + group + '.amt'));
      if (!n || !(amt > 0)) return void f.fail('ch.' + group + '.amt', 'Select a charge and amount');
      void saveCharges([...charges, { name: n, amount: amt, group }], 'Charge added: ' + n).then(() => f.clear('ch.' + group));
    };
    const chRows = (g: Charge['group']) => charges.filter((x) => x.group === g).map((x, i) => ({ key: g + i, title: x.name, right: price(x.amount), actions: [{ label: '🗑', variant: 'red' as const, onClick: () => void saveCharges(charges.filter((y) => y !== x)) }] }));
    const fullRows: Array<[string, string]> = fullRec ? [['Payment No', 'FP-' + shortId(d.id, d.referenceId)], ['Date', date(str(fullRec.paymentDate))], ['Final Payment', price(num(fullRec.amount))], ['Method', methodLabel(fullRec.method)], ['Reference', str(fullRec.reference)], ['Total Received', price(totalPaid)]] : [];
    main.push(
      { title: 'Payment Summary', cols: 3, fields: [{ label: 'Agreed', value: price(agreed), strong: true }, { label: 'Token Paid', value: price(tokenAmount) }, { label: 'Balance Due', value: price(Math.max(0, bal)), strong: true, color: '#c2410c' }] },
      {
        title: 'Property Cost',
        subtitle: 'Base Property Price ' + price(agreed) + ' — Agreed price, cannot change',
        rows: chRows('prop'),
        form: [f.inp('ch.prop.name', 'Add line', { type: 'select', options: CHARGES }), f.inp('ch.prop.amt', 'Amount (₹)', { type: 'number' })],
        actions: [
          btn('+ Add', () => addCharge('prop')),
          btn('Print', () => printReceipt('Payment Breakdown — ' + d.propertyTitle, [['Base price', price(agreed)], ...charges.map((c) => [c.name, price(c.amount)] as [string, string]), ['Total', price(total)]])),
          btn('Share', () => msg('whatsapp', 'Payment breakdown for ' + d.propertyTitle + ': total ' + price(total))),
        ],
        banners: [{ text: 'Property Sub-total: ' + price(agreed + sub('prop')), tone: 'muted' }],
      },
      {
        title: 'Registration & Legal Cost',
        subtitle: 'Karnataka registration rates',
        rows: chRows('reg'),
        form: [f.inp('ch.reg.name', 'Add line', { type: 'select', options: ['Legal / Documentation Fee', 'GST (if applicable)', 'Auto-fill GST 5%'] }), f.inp('ch.reg.amt', 'Amount (₹)', { type: 'number' })],
        actions: [btn('+ Add', () => addCharge('reg'))],
        banners: [{ text: 'Registration Sub-total: ' + price(sub('reg')), tone: 'muted' }],
      },
      { title: 'Other Charges', rows: chRows('other'), empty: chRows('other').length ? '' : 'No other charges added', form: [f.inp('ch.other.name', 'Charge name', { placeholder: 'e.g. Solar Panel Installation Charge' }), f.inp('ch.other.amt', 'Amount (₹)', { type: 'number' })], actions: [btn('+ Add Charge', () => addCharge('other'))] },
      { title: 'Total Cost to Buyer', fields: [{ label: 'Total', value: price(total), strong: true }, { label: 'Received so far', value: price(totalPaid), color: '#15803d' }], banners: [total > agreed * 1.15 ? { text: '⚠️ Total is 15%+ above agreed price', tone: 'warn' } : null] },
      fullRec
        ? {
            title: 'Payment Confirmation',
            fields: fullRows.map(([l, v]) => ({ label: l, value: v, strong: l === 'Final Payment' || l === 'Total Received' })),
            banners: [totalPaid === total ? { text: '✅ Full payment received', tone: 'success' } : totalPaid > total ? { text: 'Overpayment — verify amount', tone: 'error' } : { text: 'Underpayment — check records', tone: 'warn' }],
            actions: [btn('📥 Download', () => printReceipt('Full Payment Confirmation', fullRows)), btn('Send to Buyer', () => msg('whatsapp', 'Full payment of ' + price(num(fullRec.amount)) + ' received. Thank you!'))],
          }
        : {
            title: 'Full Payment',
            form: payForm(f, 'f.', today, { amount: Math.max(0, bal), proof: true, hint: 'Includes: property cost + registration + other charges' }),
            actions: [
              btn('Reset to agreed price', () => f.set('f.amount', String(agreed - tokenAmount))),
              btn('Record Full Payment', () => {
                const pay = payValid(f, 'f.', today, { amount: Math.max(0, bal) }, { proof: true });
                if (!pay) return;
                void plan({ paymentType: 'full', fullPayment: { ...fp, charges, payment: pay } }, '✅ Full payment recorded').then(() => f.clear('f.'));
              }, 'primary'),
            ],
          },
      next([btn('📄 Move to Documentation', () => void move('documentation'), 'green', { disabled: !fullRec })], fullRec ? [] : [{ text: 'Record the full payment to continue', tone: 'muted' }]),
    );
  }

  if (stage === 'stage_payment') {
    const sp = d.stagePayment;
    const ms = d.milestones;
    const bal = agreed - tokenAmount;
    const planned = ms.reduce((t, m) => t + m.amount, 0);
    const planStatus = str(sp.planStatus, 'accepted');
    const n = Number(f.str('sp.n', '3'));
    const saveMs = (list: Raw[], extra: Raw = {}, m?: string) => plan({ paymentType: 'stage', stagePayment: { ...sp, milestones: list, ...extra } }, m);
    const msRaw = arr(sp.milestones).map((x) => asRaw(x));
    const setMs = (i: number, patch: Raw, extra: Raw = {}, m?: string) => saveMs(msRaw.map((x, j) => (j === i ? { ...x, ...patch } : x)), extra, m);
    main.push(
      !ms.length
        ? {
            title: 'Stage Payment Plan',
            fields: [{ label: 'Agreed price', value: price(agreed) }, { label: 'Balance to schedule', value: price(bal), strong: true }],
            form: [
              f.inp('sp.n', 'Number of stages', { type: 'select', options: ['2', '3', '4', '5'], default: '3' }),
              ...Array.from({ length: n }, (_, i) => [
                f.inp('sp.name' + i, 'Milestone ' + (i + 1), { placeholder: 'e.g. Foundation Complete' }),
                f.inp('sp.due' + i, 'Due date', { type: 'date', min: today }),
                f.inp('sp.amt' + i, 'Amount (₹)', { type: 'number' }),
              ]).flat(),
            ],
            banners: [Array.from({ length: n }, (_, i) => Number(f.str('sp.amt' + i)) || 0).reduce((x, y) => x + y, 0) === bal ? { text: '✅ Amounts match', tone: 'success' } : { text: 'Scheduled total must equal ' + price(bal), tone: 'muted' }],
            actions: [
              btn('Split balance evenly', () => {
                for (let i = 0; i < n; i++) {
                  f.set('sp.amt' + i, String(i === n - 1 ? bal - Math.floor(bal / n) * (n - 1) : Math.floor(bal / n)));
                  if (!f.str('sp.due' + i)) f.set('sp.due' + i, addDaysIso(today, 30 * (i + 1)));
                  if (!f.str('sp.name' + i)) f.set('sp.name' + i, ['Booking Confirmation', 'Foundation Complete', 'Structure Complete', 'Flooring & Finishing', 'Handover'][i] ?? 'Milestone ' + (i + 1));
                }
              }),
              btn('Send Plan', () => {
                const rows = Array.from({ length: n }, (_, i) => ({ id: 'MS-' + (i + 1), name: f.str('sp.name' + i), dueDate: f.str('sp.due' + i), amount: Number(f.str('sp.amt' + i)) || 0, status: 'pending' }));
                if (rows.some((r) => !r.name || !r.dueDate || !r.amount)) return toast('Fill every milestone name, date and amount');
                if (rows.reduce((x, r) => x + r.amount, 0) !== bal) return toast('Amounts must add up to ' + price(bal));
                modal.open({
                  title: 'Send payment plan to buyer',
                  banners: [{ text: '📱 Buyer will receive: "Your payment plan is ready — ' + n + ' milestones"', tone: 'muted' }],
                  fields: [{ key: 'ch', label: 'Send via', type: 'select', options: ['WhatsApp', 'Email'], default: 'WhatsApp' }],
                  submit: 'Send Plan & Notify Buyer',
                  onSubmit: async (v) => {
                    await saveMs(rows, { planStatus: 'sent' });
                    f.clear('sp.');
                    msg(v.ch === 'Email' ? 'email' : 'whatsapp', 'Hi ' + first + ', your payment plan for ' + d.propertyTitle + ' is ready — ' + n + ' milestones: ' + rows.map((r) => r.name + ' ' + price(r.amount) + ' by ' + date(r.dueDate + 'T12:00:00')).join('; ') + '.');
                    toast('📤 Plan saved — send the message to notify the buyer');
                  },
                });
              }, 'primary'),
            ],
          }
        : {
            title: 'Payment Milestones',
            subtitle: price(planned) + ' scheduled · plan ' + planStatus,
            rows: ms.map((m, i) => {
              const od = m.status !== 'paid' && !!m.dueDate && m.dueDate.slice(0, 10) < today;
              const s = od && m.status !== 'proof_pending' ? 'overdue' : m.status;
              const st = MS_ST[s] ?? MS_ST.pending!;
              return {
                key: m.id,
                title: m.name + ' · ' + price(m.amount),
                sub: 'Due ' + date(m.dueDate),
                badges: [badge(st[0], st[1])],
                actions:
                  s === 'proof_pending'
                    ? [
                        m.proofUrl ? { label: 'View proof', onClick: () => void window.open(m.proofUrl, '_blank', 'noopener,noreferrer') } : null,
                        { label: 'Verify now ⚠️', variant: 'green', onClick: () => void setMs(i, { status: 'paid', paidAt: new Date().toISOString() }, {}, 'Milestone Verified! ✅') },
                        { label: 'Reject proof', variant: 'red', onClick: () => askConfirm({ title: 'Reject proof?', message: '📱 Buyer will receive rejection notice', input: { label: 'Rejection reason (required)', required: true }, confirmLabel: 'Reject & Notify Buyer', tone: 'destructive', onConfirm: ({ value }) => setMs(i, { status: 'pending', proofRejectedReason: value, proofSubmittedAt: null }, {}, 'Proof Needs Resubmission') }) },
                      ]
                    : s === 'overdue'
                      ? [{ label: 'Send Reminder', onClick: () => msg('whatsapp', 'Hi ' + first + ', the "' + m.name + '" payment of ' + price(m.amount) + ' was due on ' + date(m.dueDate) + '.') }]
                      : [],
              };
            }),
            chips: [['accepted', '✅ Buyer Accepted Plan'], ['negotiating', '💬 Negotiating'], ['declined', '❌ Declined']].map(([k, l]) => ({ label: l!, on: planStatus === k, onClick: () => void saveMs(msRaw, { planStatus: k }, 'Plan response: ' + k) })),
            banners: ms.every((m) => m.status === 'paid') ? [{ text: '✅ All milestones paid', tone: 'success' }] : [],
            actions: [btn('Edit Plan', () => void saveMs([], { planStatus: '' }))],
          },
      ms.length
        ? {
            title: 'Record Stage Payment',
            form: [f.inp('sp.ms', 'Which stage?', { type: 'select', options: ms.filter((m) => m.status !== 'paid').map((m) => ({ value: m.id, label: m.name })), placeholder: 'Select milestone…' }), ...payForm(f, 'spp.', today, { proof: true })],
            banners: f.str('sp.ms') && Number(f.str('spp.amount')) && Number(f.str('spp.amount')) < (ms.find((m) => m.id === f.str('sp.ms'))?.amount ?? 0) ? [{ text: 'Amount less than milestone amount', tone: 'warn' }] : [],
            actions: [
              btn('Record Payment', () => {
                if (!f.str('sp.ms')) return void f.fail('sp.ms', 'Select a milestone');
                const pay = payValid(f, 'spp.', today, {}, { proof: true });
                if (!pay) return;
                const i = ms.findIndex((m) => m.id === f.str('sp.ms'));
                void setMs(i, { status: 'paid', paidAt: new Date().toISOString(), payment: pay }, {}, '✅ Stage payment recorded').then(() => { f.clear('sp'); });
              }, 'primary'),
            ],
          }
        : null,
      next(
        [btn('📤 Send Payment Reminder', () => msg('whatsapp', 'Hi ' + first + ', a reminder about your next milestone payment for ' + d.propertyTitle + '.')), btn('📄 Move to Documentation', () => (ms.length ? void move('documentation') : toast('Create payment plan first')), 'green', { disabled: !ms.length })],
        !ms.length ? [{ text: 'Create payment plan first', tone: 'muted' }] : [],
      ),
    );
  }

  if (stage === 'interior_design') {
    const it = d.interiorDesign;
    const quote = it.quote ? asRaw(it.quote) : null;
    const saveIt = (patch: Raw, m?: string) => plan({ interiorDesign: { ...it, ...patch } }, m);
    const avail = designers.filter((x) => x.isAvailable);
    main.push(
      { title: 'Interior Design Request', fields: [{ label: 'Selected rooms', value: str(it.rooms) }, { label: 'Style', value: str(it.style) }, { label: 'Budget', value: str(it.budget) }], text: 'Source: app INT-04 · Buyer expressed interest via app' },
      {
        title: 'Assign Designer',
        fields: [{ label: 'Designer', value: str(it.designer) || 'Not assigned', strong: true }],
        form: [f.inp('in.d', 'Select designer', { type: 'select', options: designers.map((x) => ({ value: x.name, label: x.name + ' · ' + (x.isAvailable ? 'available' : 'busy') })), placeholder: 'Choose…' })],
        banners: avail.length ? [] : [{ text: 'No available designers found.', tone: 'warn' }],
        actions: [btn(str(it.designer) ? 'Change Designer' : 'Assign', () => { if (!f.str('in.d')) return void f.fail('in.d', 'Choose a designer'); void saveIt({ designer: f.str('in.d') }, '🎨 Designer assigned').then(() => f.set('in.d', '')); }, 'primary')],
      },
      {
        title: 'Consultation',
        fields: [{ label: 'Consultation scheduled', value: str(it.consult) ? date(str(it.consult) + 'T12:00:00') : 'Not scheduled' }],
        form: [f.inp('in.c', 'Consultation date', { type: 'date', min: today })],
        actions: [btn(str(it.consult) ? 'Reschedule' : 'Schedule Consultation', () => { if (!f.str('in.c')) return void f.fail('in.c', 'Pick a date'); void saveIt({ consult: f.str('in.c') }, '📅 Consultation scheduled').then(() => f.set('in.c', '')); })],
      },
      quote && !f.val<boolean>('in.edit', false)
        ? {
            title: 'Interior Quote',
            fields: [{ label: 'Package', value: str(quote.pkg), strong: true }, { label: 'Amount', value: price(num(quote.amount)), strong: true }, { label: 'Timeline', value: (num(quote.weeks) ?? 0) + ' weeks' }, { label: 'Status', value: statusLabel(str(quote.status)) }],
            text: str(quote.inclusions),
            actions: [
              btn('Send Quote to Buyer (WhatsApp)', () => msg('whatsapp', 'Your interior quote: ' + str(quote.pkg) + ' — ' + price(num(quote.amount)) + ', ' + num(quote.weeks) + ' weeks.', { onSent: () => void saveIt({ quote: { ...quote, status: 'sent' } }) })),
              btn('Edit Quote', () => f.set('in.edit', true)),
              btn('✅ Buyer Accepted Quote', () => void saveIt({ quote: { ...quote, status: 'accepted' } }, 'Interior quote accepted'), 'green'),
              btn('💬 Buyer Wants to Negotiate', () => void saveIt({ quote: { ...quote, status: 'negotiating' } }, 'Interior quote negotiating')),
              btn('❌ Buyer Declined', () => void saveIt({ quote: { ...quote, status: 'declined' } }, 'Quote declined by buyer.').then(() => askConfirm({ title: 'Quote declined by buyer.', message: 'Skip interior and move to documentation?', confirmLabel: 'Skip Interior', onConfirm: () => move('documentation') })), 'red'),
            ],
          }
        : {
            title: 'Interior Quote',
            form: [
              f.inp('in.pkg', 'Package name', { required: true, default: str(quote?.pkg) }),
              f.inp('in.amt', 'Total quote amount (₹)', { type: 'number', required: true, default: quote ? String(num(quote.amount) ?? '') : '' }),
              f.inp('in.wk', 'Timeline (weeks)', { type: 'number', required: true, default: quote ? String(num(quote.weeks) ?? '') : '' }),
              f.inp('in.inc', 'Inclusions', { type: 'textarea', required: true, default: str(quote?.inclusions) }),
              f.inp('in.terms', 'Terms (optional)', { type: 'textarea', default: str(quote?.terms) }),
            ],
            actions: [
              btn('Save Quote', () => {
                const defs = { 'in.pkg': str(quote?.pkg), 'in.amt': quote ? String(num(quote.amount) ?? '') : '', 'in.wk': quote ? String(num(quote.weeks) ?? '') : '', 'in.inc': str(quote?.inclusions) };
                if (!f.need({ 'in.pkg': 'Package name is required', 'in.amt': 'Amount is required', 'in.wk': 'Timeline is required', 'in.inc': 'Inclusions are required' }, defs)) return;
                void saveIt({ quote: { pkg: f.str('in.pkg', defs['in.pkg']), amount: Number(f.str('in.amt', defs['in.amt'])), weeks: Number(f.str('in.wk', defs['in.wk'])), inclusions: f.str('in.inc', defs['in.inc']), terms: f.str('in.terms', str(quote?.terms)), status: 'pending' } }, '✅ Quote saved').then(() => f.clear('in.'));
              }, 'primary'),
            ],
          },
      quote && str(quote.status) === 'accepted'
        ? {
            title: 'Interior Payment',
            rows: arr(it.payments).map((x, i) => { const r = asRaw(x); return { key: String(i), title: price(num(r.amount)), sub: str(r.reference) + ' · ' + date(str(r.paymentDate)), badges: [badge('Paid', 'green')] }; }),
            form: payForm(f, 'ip.', today, { proof: true }),
            actions: [btn('Record Payment', () => { const pay = payValid(f, 'ip.', today, {}, { proof: true }); if (!pay) return; void saveIt({ payments: [...arr(it.payments), pay] }, '✅ Interior payment recorded').then(() => f.clear('ip.')); }, 'primary')],
          }
        : null,
      next([btn('📄 Move to Documentation', () => void move('documentation'), 'green'), btn("Skip — Buyer doesn't want interior", () => void plan({ interiorDesign: { ...it, skipped: true } }).then(() => move('documentation')))]),
    );
  }

  const legal = legalSection({
    mode: 'buyer',
    state: doc as LegalState,
    f,
    party: { name: d.buyerName, phone: d.buyerPhone, email: d.buyerEmail },
    entity,
    openForm: modal.open,
    save: (patch) => exec(() => updateSalesDeal(d.id, { documentation: { ...doc, ...patch } })),
    upload: async (file, name) => (await uploadProof('sales_deal', d.id, file, { summary: 'Buyer document uploaded: ' + name })).attachments[0]?.url || '',
  });

  if (stage === 'documentation') {
    const reg = wfd.registration ? asRaw(wfd.registration) : null;
    const hoState = asRaw(wfd.handover);
    const ho = checksDone(HANDOVER, hoState);
    const regDate = str(reg?.date);
    main.push(
      reg && regDate < today && !reg.done ? { title: 'Registration', banners: [{ text: '❌ Registration date passed! Update registration date', tone: 'error' }] } : null,
      {
        title: 'Payment Summary',
        cols: 3,
        fields: [
          { label: 'Agreed Price', value: price(agreed), strong: true },
          { label: 'Token Paid', value: price(tokenAmount) },
          { label: 'Total Received', value: price(totalPaid), color: '#15803d', strong: true },
          { label: 'Payment Type', value: d.paymentType === 'stage' ? 'Stage Payment' : 'Full Payment' },
          { label: 'Balance', value: price(Math.max(0, agreed - totalPaid)), color: agreed - totalPaid > 0 ? '#c2410c' : '#15803d' },
        ],
      },
      legal,
      {
        title: 'Property Registration',
        fields: reg ? [{ label: 'Registration date', value: date(regDate + 'T12:00:00') }, { label: 'Office', value: str(reg.office) }, { label: 'Sub-registrar', value: str(reg.sub) }, { label: 'Stamp duty', value: price(Math.round(agreed * 0.056)) }, { label: 'Registration fee', value: price(Math.round(agreed * 0.01)) }] : [],
        form: reg && !f.val<boolean>('rg.edit', false) ? [] : [f.inp('rg.date', 'Registration date', { type: 'date', required: true, default: regDate }), f.inp('rg.office', 'Office', { placeholder: d.propertyLocation.includes('Bengaluru') ? 'Jayanagar SRO' : 'Tambaram SRO', default: str(reg?.office) }), f.inp('rg.sub', 'Sub-registrar', { default: str(reg?.sub) })],
        actions: [
          reg && !f.val<boolean>('rg.edit', false)
            ? btn('Edit', () => f.set('rg.edit', true))
            : btn('Save Registration Details', () => {
                if (!f.need({ 'rg.date': 'Registration date is required' }, { 'rg.date': regDate })) return;
                void saveWf({ registration: { date: f.str('rg.date', regDate), office: f.str('rg.office', str(reg?.office)), sub: f.str('rg.sub', str(reg?.sub)) } }, '✅ Registration details saved').then(() => f.clear('rg.'));
              }, 'primary'),
        ],
      },
      { ...checksSection('Property Handover', HANDOVER, hoState, (s) => void saveWf({ handover: s })), subtitle: 'Handover checklist · ' + ho + '/' + HANDOVER.length },
      next([
        btn('🎉 Mark Deal as Closed', () =>
          askConfirm({
            title: 'Close this deal?',
            message: [ho < HANDOVER.length ? '⚠️ Handover checklist incomplete' : '', legal.verified < legal.required ? 'Verify all required documents' : ''].filter(Boolean).join('\n') || 'The property will be marked as Sold.',
            confirmLabel: '✅ Close Deal',
            tone: 'green',
            onConfirm: async () => {
              await closeDeal(d.id, {});
              if (d.propertyId) {
                await updatePropertyStatus(d.propertyId, { status: 'sold', reason: 'Deal closed' }).catch(() => null);
                await updateProperty(d.propertyId, { isFeatured: false }).catch(() => null);
              }
              void q.refetch();
              setStageBanner(salesStage('closed'));
              toast('Congratulations! 🎉 Deal closed');
            },
          }), 'green'),
      ]),
    );
  }

  if (stage === 'closed') {
    const docsMap = asRaw(doc.docs);
    main.push(
      {
        title: '🎉 Deal Closed Successfully!',
        subtitle: 'Deal Complete',
        fields: [
          { label: 'Property', value: d.propertyTitle },
          { label: 'Buyer', value: d.buyerName },
          { label: 'Listed Price', value: price(d.listedPrice) },
          { label: 'Agreed Price', value: price(agreed), strong: true },
          { label: 'Discount', value: price(Math.max(0, d.listedPrice - agreed)) },
          { label: 'Total Received', value: price(totalPaid), color: '#15803d', strong: true },
          { label: 'Closed On', value: date(d.closedAt || d.stageEnteredAt) },
          { label: 'Assigned To', value: assigned },
        ],
        banners: [totalPaid >= agreed ? { text: '✅ Fully paid', tone: 'success' } : { text: 'Balance outstanding ' + price(agreed - totalPaid), tone: 'warn' }],
      },
      { title: 'Deal Journey', timeline: FLOW.map((x) => ({ text: x.label, time: '✓', color: '#22c55e' })) },
      {
        title: 'Final Documents',
        rows: Object.keys(BUYER_LEGAL).map((k) => {
          const names = BUYER_LEGAL[k] ?? [];
          const ok = names.filter((n) => ['sent', 'verified'].includes(str(asRaw(docsMap[n]).status))).length;
          return { key: k, title: k, sub: ok + '/' + names.length + ' sent', badges: [ok === names.length ? badge('Verified', 'green') : badge('Incomplete', 'amber')] };
        }),
      },
      {
        title: '📱 Request App Review from Buyer',
        banners: wfd.reviewRequested ? [{ text: 'Review requested', tone: 'success' }] : [],
        actions: [
          btn('WhatsApp', () => msg('whatsapp', 'Hi ' + first + ', congratulations on your new home! Could you rate BuiltGlory in the app?', { onSent: () => void saveWf({ reviewRequested: true }) }), 'green'),
          btn('Email', () => msg('email', 'Congratulations on your new home!', { onSent: () => void saveWf({ reviewRequested: true }) })),
        ],
      },
      { title: 'This deal is complete ✅', text: 'No further actions are needed.' },
    );
  }

  if (stage === 'lost') {
    const refund = wfd.refund ? asRaw(wfd.refund) : null;
    main.push(
      {
        title: '❌ Deal Lost',
        fields: [
          { label: 'Property', value: d.propertyTitle },
          { label: 'Buyer', value: d.buyerName },
          { label: 'Stage Lost At', value: str(wfd.lostAtStage) || d.lostAtStage ? salesStage(str(wfd.lostAtStage) || d.lostAtStage) : '' },
          { label: 'Lost On', value: date(str(wfd.lostAt) || d.stageEnteredAt) },
          { label: 'Lost Reason', value: d.lostReason || 'No reason recorded', strong: true },
          { label: 'Assigned To', value: assigned },
          { label: 'Last Agreed', value: agreed ? price(agreed) : '—' },
        ],
        actions: d.lostReason ? [] : [btn('+ Add Reason', () => lose('Add Reason'))],
      },
      { title: 'Why was this lost?', formCols: 1, form: [f.inp('an', 'Analysis', { type: 'textarea', default: str(wfd.analysis), placeholder: 'What could we have done differently?' })], actions: [btn('Save Analysis', () => void saveWf({ analysis: f.str('an', str(wfd.analysis)) }, 'Analysis saved'))] },
      tokenAmount
        ? refund
          ? { title: 'Token Refund', banners: [{ text: '✅ Refund request recorded: ' + price(tokenAmount) + ' to ' + str(refund.name) + ' — process the transfer in finance', tone: 'success' }] }
          : {
              title: 'Token Refund',
              banners: [{ text: 'Refund Pending — ' + price(tokenAmount), tone: 'warn' }],
              form: [
                f.inp('rf.reason', 'Reason', { type: 'select', options: ['Deal cancelled by buyer', 'Property no longer available', 'Terms not agreed', 'Admin decision', 'Other'], required: true }),
                f.inp('rf.name', 'Beneficiary name', { default: d.buyerName }),
                f.inp('rf.acc', 'Bank account number'),
                f.inp('rf.ifsc', 'IFSC code'),
              ],
              actions: [
                btn('Process Refund', () => {
                  if (!f.need({ 'rf.reason': 'Reason is required', 'rf.acc': 'Account number is required', 'rf.ifsc': 'IFSC is required' })) return;
                  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.str('rf.ifsc').toUpperCase())) return void f.fail('rf.ifsc', 'Invalid IFSC code');
                  void saveWf({ refund: { name: f.str('rf.name', d.buyerName), reason: f.str('rf.reason'), accountLast4: f.str('rf.acc').slice(-4), ifsc: f.str('rf.ifsc').toUpperCase(), amount: tokenAmount, requestedAt: new Date().toISOString() } }, '💸 Refund request recorded').then(() => f.clear('rf.'));
                }, 'primary'),
              ],
            }
        : null,
      {
        title: 'Recovery Options',
        stack: true,
        banners: wfd.archived ? [{ text: 'Archived', tone: 'muted' }] : [],
        actions: wfd.archived
          ? []
          : [
              btn('♻️ Re-engage Buyer', () => askConfirm({ title: 'Move to re-engagement?', confirmLabel: 'Re-engage', onConfirm: () => move('re_engagement', { reengagement: { lastContactAt: new Date().toISOString(), attempts: 0 } }) }), 'green'),
              btn('🔄 Start New Deal', () =>
                askConfirm({
                  title: 'Start new deal',
                  message: 'Create new deal for this buyer with a different property?',
                  select: { label: 'Property', placeholder: availQ.isPending ? 'Loading properties…' : 'Select property', options: (availQ.data ?? []).filter((x) => x.id !== d.propertyId).map((x) => x.id + ' · ' + x.title), required: true },
                  confirmLabel: 'Create Deal',
                  onConfirm: async ({ select }) => {
                    const pid = select.split(' · ')[0]!;
                    const nd = await createSalesDeal({ buyerId: d.buyerId, propertyId: pid, ...(d.assignedTo ? { assignedTo: d.assignedTo } : {}) });
                    navigate('/admin/sales/' + nd.id);
                  },
                })),
              btn('📊 Mark as Permanently Lost', () => askConfirm({ title: 'Mark as permanently lost?', message: 'This deal will be archived.', confirmLabel: 'Archive', tone: 'destructive', onConfirm: () => saveWf({ archived: true }, 'Deal archived') }), 'red'),
            ],
      },
      wf.callLog(),
    );
  }

  if (stage === 're_engagement') {
    const rePlan = wfd.rePlan ? asRaw(wfd.rePlan) : null;
    const outreach = arr(wfd.outreach).map((x) => asRaw(x));
    const suggested = arr(wfd.suggested).map((x) => str(x));
    const altQ = f.str('alt.q').toLowerCase();
    const alts = (recsQ.data ?? []).filter((x) => !altQ || x.title.toLowerCase().includes(altQ)).slice(0, 5);
    main.push(
      { title: '🔄 Re-engagement in Progress', fields: [{ label: 'Property', value: d.propertyTitle }, { label: 'Original Stage Lost', value: str(wfd.lostAtStage) ? salesStage(str(wfd.lostAtStage)) : '' }, { label: 'Days Since Lost', value: days + ' days' }, { label: 'Re-engagement Started', value: date(d.stageEnteredAt) }] },
      {
        title: 'Follow-up & Re-contact',
        fields: [{ label: 'Follow-up date', value: d.reengagement.followUpAt ? date(d.reengagement.followUpAt) : 'Not set' }],
        form: [f.inp('fu', 'Follow-up date', { type: 'date', min: today })],
        actions: [
          btn('Save Follow-up', () => { if (!f.str('fu')) return void f.fail('fu', 'Pick a date'); void exec(() => updateSalesDeal(d.id, { reengagement: { ...d.reengagement, followUpAt: f.str('fu') } }), 'Follow-up date saved').then(() => f.set('fu', '')); }),
          btn('📞 Call', () => callPhone(d.buyerName, d.buyerPhone)),
          btn('💬 WhatsApp', () => msg('whatsapp'), 'green'),
          btn('📧 Email', () => msg('email')),
        ],
      },
      rePlan && !f.val<boolean>('re.edit', false)
        ? { title: 'Re-engagement Strategy', fields: [{ label: 'Reason', value: str(rePlan.reason) }, { label: 'Offer', value: str(rePlan.offer) }], text: str(rePlan.approach), banners: [{ text: 'Plan saved', tone: 'success' }], actions: [btn('Edit', () => f.set('re.edit', true))] }
        : {
            title: 'Re-engagement Strategy',
            form: [
              f.inp('re.reason', 'Reason for re-engagement', { type: 'select', options: RE_REASONS, required: true, default: str(rePlan?.reason) }),
              f.inp('re.offer', 'Offer to buyer (optional)', { default: str(rePlan?.offer) }),
              f.inp('re.app', 'Planned approach', { type: 'textarea', required: true, placeholder: 'What is your plan to win back this buyer?', default: str(rePlan?.approach) }),
            ],
            actions: [
              btn('Save Plan', () => {
                const defs = { 're.reason': str(rePlan?.reason), 're.app': str(rePlan?.approach) };
                if (!f.need({ 're.reason': 'Reason is required', 're.app': 'Planned approach is required' }, defs)) return;
                void saveWf({ rePlan: { reason: f.str('re.reason', defs['re.reason']), offer: f.str('re.offer', str(rePlan?.offer)), approach: f.str('re.app', defs['re.app']) } }, 'Plan saved').then(() => f.clear('re.'));
              }, 'primary'),
            ],
          },
      {
        title: 'Re-engagement Outreach',
        rows: outreach.map((o, i) => ({ key: String(i), title: str(o.channel), sub: str(o.notes) + ' · ' + relativeLong(str(o.at)) })),
        empty: outreach.length ? '' : 'No outreach logged',
        banners: outreach.length >= 4 ? [{ text: 'Multiple attempts — consider closing re-engagement', tone: 'warn' }] : [],
        form: [f.inp('ro.ch', 'Channel', { type: 'select', options: ['Call', 'WhatsApp', 'Email', 'In-person'], default: 'Call' }), f.inp('ro.notes', 'Notes')],
        actions: [
          btn('+ Log Outreach', () =>
            void exec(async () => {
              const at = new Date().toISOString();
              await updateSalesDeal(d.id, { documentation: { ...doc, workflow: { ...wfd, outreach: [...outreach, { channel: f.str('ro.ch', 'Call'), notes: f.str('ro.notes') || '—', at }] } }, reengagement: { ...d.reengagement, lastContactAt: at, attempts: d.reengagement.attempts + 1 } });
            }, 'Outreach logged').then(() => f.clear('ro.'))),
        ],
      },
      {
        title: 'Suggest Alternative Properties',
        formCols: 1,
        form: [f.inp('alt.q', '', { placeholder: 'Search properties…' })],
        rows: alts.map((x) => ({
          key: x.id,
          title: x.title,
          sub: price(x.price) + ' · ' + x.location + (x.reason ? ' · ' + x.reason : ''),
          badges: [suggested.includes(x.id) ? badge('Suggested', 'green') : null],
          actions: [{ label: 'Suggest to Buyer', onClick: () => msg('whatsapp', 'You may like ' + x.title + ' — ' + price(x.price), { onSent: () => void saveWf({ suggested: [...suggested, x.id] }, '📤 Suggestion sent') }) }],
        })),
        empty: recsQ.isPending ? 'Loading recommendations…' : alts.length ? '' : 'No recommended properties found',
      },
      next([btn('Move Back to Active Leads', () => void move('active_leads'), 'green')], [{ text: 'Lost is only available from Active Leads, Site Visits, or Negotiation. Move this buyer back before closing them as lost.', tone: 'muted' }]),
    );
  }

  main.push(wf.notes('Internal Notes'));

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/sales/all"
      crumbs={[{ label: 'Sales Pipeline', path: '/admin/sales/all' }, { label, path: '/admin/sales/' + (TAB[stage] || 'all') }, { label: d.buyerName + ' — ' + d.propertyTitle }]}
      title={d.buyerName + ' — ' + d.propertyTitle}
      badges={[{ text: label, dot: STAGE_DOT.sales[stage] || '#94a3b8' }, d.priority !== 'normal' ? { text: statusLabel(d.priority), tone: d.priority === 'urgent' ? 'red' : 'orange' } : null]}
      meta={shortId(d.id, d.referenceId) + ' • Created: ' + date(d.createdAt) + ' • ' + days + ' days in current stage' + (days > 14 && !['closed', 'lost'].includes(stage) ? ' • ⚠️ Stalled' : '')}
      hActions={[
        btn('📞 Call Buyer', () => callPhone(d.buyerName, d.buyerPhone)),
        btn('💬 WhatsApp', () => msg('whatsapp'), 'green'),
        btn('📧 Email', () => msg('email'), 'outline', { disabled: !d.buyerEmail }),
        btn('👤 Assign To' + (assigned ? ': ' + assigned : ''), () => {
          if (!team.length) return toast('No sales team found');
          modal.open({
            title: 'Assign To',
            fields: [{ key: 'w', label: 'Team member', type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), required: true, default: d.assignedTo || '' }],
            onSubmit: async (v) => {
              await updateSalesDeal(d.id, { assignedTo: String(v.w) });
              void q.refetch();
              toast('👤 Assigned to ' + (nameOf(String(v.w)) || 'team member'));
            },
          });
        }),
        btn('⚑ Priority: ' + statusLabel(d.priority), () =>
          modal.open({
            title: 'Priority',
            fields: [{ key: 'p', label: 'Priority', type: 'select', options: ['urgent', 'high', 'normal'].map((v) => ({ value: v, label: statusLabel(v) })), default: d.priority, required: true }],
            onSubmit: async (v) => {
              await updateSalesDeal(d.id, { priority: String(v.p) });
              void q.refetch();
            },
          })),
      ]}
      banners={[
        lock,
        stageBanner ? { text: 'Stage updated to ' + stageBanner, tone: 'info', actions: [{ label: 'Send WhatsApp to Buyer', onClick: () => msg('whatsapp', 'Hi ' + first + ', an update on ' + d.propertyTitle + ': your deal moved to ' + stageBanner + '.') }], dismiss: () => setStageBanner(null) } : null,
      ]}
      steps={['lost', 're_engagement'].includes(stage) ? [] : FLOW}
      currentStep={idx}
      main={['lost', 're_engagement'].includes(stage) ? [{ title: label, banners: [{ text: stage === 'lost' ? '❌ Lost' : '🔄 Re-engagement', tone: stage === 'lost' ? 'error' : 'warn' }] }, ...main] : main}
      side={[
        personSection('Buyer', { name: d.buyerName, phone: d.buyerPhone, email: d.buyerEmail }, [], d.buyerId ? '/admin/users/' + d.buyerId : null, 'View Buyer Profile →', navigate),
        propertySection('Property', p, { id: d.propertyId, title: d.propertyTitle, price: d.listedPrice, type: d.propertyType, location: d.propertyLocation, image: d.photos[0] }, navigate),
        {
          title: 'Deal Summary',
          cols: 1,
          fields: [
            { label: 'Listed Price', value: price(d.listedPrice) },
            { label: 'Offered', value: d.offeredPrice ? price(d.offeredPrice) : '—' },
            { label: 'Agreed', value: agreed ? price(agreed) : '—', strong: true, color: '#15803d' },
            { label: 'Token Paid', value: price(tokenAmount) },
            { label: 'Total Paid', value: price(totalPaid), strong: true },
            { label: 'Payment Type', value: d.paymentType ? statusLabel(d.paymentType) : '—' },
          ],
        },
        ['closed', 'lost'].includes(stage)
          ? null
          : {
              title: 'Quick Actions',
              stack: true,
              actions: [
                btn('📋 Move Stage…', () => {
                  const askToken = stage === 'token_payment' && !d.tokenPaid;
                  const nextStages = (STAGE_NEXT[stage] || []).flatMap((value) => {
                    const found = SALES_STAGES.find(([id]) => id === value);
                    return found ? [found] : [];
                  });
                  if (!nextStages.length) return toast('This stage has no further moves.');
                  modal.open({
                    title: 'Move Stage',
                    banners: askToken ? [{ text: 'Full Payment and Stage Payment need a token payment recorded on this deal.', tone: 'info' }] : [],
                    fields: [{ key: 's', label: 'Stage', type: 'select', options: nextStages.map(([value, l]) => ({ value, label: l })), required: true }, ...(askToken ? tokenFields() : [])],
                    validate: (v) => (askToken && ['full_payment', 'stage_payment'].includes(String(v.s)) ? tokenErrors(v) : {}),
                    submit: 'Move',
                    onSubmit: async (v) => {
                      const to = String(v.s);
                      if (askToken && ['full_payment', 'stage_payment'].includes(to)) await updateDealTokenPayment(d.id, tokenBody(v));
                      await finishMove(to);
                    },
                  });
                }),
                LOST_FROM.has(stage) ? btn('❌ Mark as Lost', () => lose(), 'red') : null,
              ],
            },
        wf.activity(),
        wf.sent(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
