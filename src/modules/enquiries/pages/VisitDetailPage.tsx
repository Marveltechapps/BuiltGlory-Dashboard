import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, contactActions, crumbsFor, personSection, propertySection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { SLOTS } from '../../../constants/enquiries';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useProperty } from '../../../hooks/useProperty';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { CALL_OUTCOMES, useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { copyText } from '../../../lib/contact';
import { badge, date, dateTime, isHttpsUrl, parseTimeMinutes, relativeLong, shortId, statusLabel, time12, time24, todayIso } from '../../../lib/format';
import type { ListResult } from '../../../lib/paging';
import { getVisit, submitVisitFeedback, updateVisitStatus, type VisitStatusBody } from '../../../services/enquiries';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import type { Visit } from '../../../types/enquiries';

const PRE = ['Confirm visit time with buyer', 'Share location / meeting link', 'Keep keys / access ready', 'Brief assigned executive', 'Carry brochure & price sheet'];
const NRI = ['Property walkthrough shown', 'RERA documents verified', 'Floor plan explained', 'Pricing discussed', 'Legal process explained', 'FEMA compliance discussed', 'Payment terms explained', 'Next steps agreed'];
const PLATFORMS: Array<[string, string, VisitStatusBody['virtualPlatform']]> = [['Zoom', 'https://zoom.us/j/', 'zoom'], ['Google Meet', 'https://meet.google.com/', 'google_meet'], ['Teams', 'https://teams.microsoft.com/l/meetup-join/', 'teams'], ['WhatsApp', '', 'whatsapp_video']];
const INTEREST_OPTS: Array<[string, string]> = [['very_interested', 'Very Interested'], ['interested', 'Interested'], ['needs_time', 'Needs Time'], ['not_interested', 'Not Interested']];
const NEXT_OPTS: Array<[string, string]> = [['move_to_negotiation', 'Start negotiation'], ['schedule_another_visit', 'Schedule another visit'], ['follow_up', 'Follow up in a week'], ['mark_lost', 'Close enquiry']];
const FOLLOW_UPS = ['Send brochure', 'Schedule physical visit', 'Share price sheet', 'Start negotiation'];

export function VisitDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const f = useFormFields();
  const modal = useFormModal();
  const [pre, setPre] = useState<Record<string, boolean>>({});
  const q = useQuery({ queryKey: ['visit', id], queryFn: ({ signal }) => getVisit(id, signal), retry: false });
  const v = q.data;
  const prop = useProperty(v?.propertyId);
  const { team, nameOf } = useSalesTeam();
  const wf = useWorkflowSections('visit', id, f, v?.createdAt);
  const lock = useEditLock('visit', id);
  const keys = [['visit', id], ['visits']];
  const patch = useRefreshingMutation((body: Omit<VisitStatusBody, 'status'> & { status?: VisitStatusBody['status'] }) => updateVisitStatus(id, { status: (body.status ?? v!.status) as VisitStatusBody['status'], ...body }), keys);
  const feedback = useRefreshingMutation((body: Parameters<typeof submitVisitFeedback>[1]) => submitVisitFeedback(id, body), keys);

  const state = detailStateOf(q);
  if (state !== 'ok' || !v) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/enquiries/visits" />;

  const today = todayIso();
  const virtual = v.visitType === 'virtual';
  const waVideo = v.virtualPlatform === 'whatsapp_video';
  const hasLink = !!v.meetingLink || waVideo;
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const passed = (v.visitDate < today || (v.visitDate === today && parseTimeMinutes(v.visitTime) < nowM)) && ['scheduled', 'confirmed', 'rescheduled'].includes(v.status);
  const first = v.buyerName.split(' ')[0];
  const entity = { type: 'visit' as const, id: v.id };
  const assigned = nameOf(v.assignedTo, v.assignedName) || v.assignedName;
  const set = (status: VisitStatusBody['status'], msg: string, extra: Partial<VisitStatusBody> = {}) => patch.mutate({ status, ...extra }, { onSuccess: () => toast(msg) });
  const complete = () => (v.feedback ? set('completed', '✔️ Visit marked as completed') : toast('Add feedback before closing this visit.'));
  const confirm = () => {
    if (v.status === 'confirmed') return toast('Already confirmed');
    if (virtual && !hasLink) return toast('Add a meeting link before confirming this visit');
    set('confirmed', '✅ Visit confirmed');
  };
  const join = () => {
    if (!v.meetingLink) return toast(waVideo ? 'WhatsApp video call — no link needed' : '⚠️ Add Meeting Link First');
    window.open(v.meetingLink, '_blank', 'noopener,noreferrer');
    toast('🎥 Opening ' + v.meetingLink);
  };
  const directions = () => {
    const dest = [v.propertyTitle, v.propertyAddress].filter(Boolean).join(', ');
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dest), '_blank', 'noopener,noreferrer');
    toast('🗺️ Opening directions to ' + (v.propertyAddress || v.propertyTitle));
  };
  const cachedVisits = (qc.getQueryData<ListResult<Visit>>(['visits'])?.items ?? []) as Visit[];
  const reschedule = () => {
    const cur = time12(v.visitTime).replace(/^(\d):/, '0$1:');
    modal.open({
      title: '🔄 Reschedule Visit',
      formCols: 2,
      fields: [
        { key: 'date', label: 'Date', type: 'date', min: today, required: true, default: v.visitDate >= today ? v.visitDate : today },
        { key: 'time', label: 'Time', type: 'select', options: SLOTS, required: true, default: SLOTS.includes(cur) ? cur : '10:00 AM' },
        { key: 'reason', label: 'Reason', full: true },
      ],
      validate: (x) => ({ date: String(x.date) < today ? 'Visit date cannot be in the past' : '' }),
      submit: 'Reschedule',
      onSubmit: async (x) => {
        const apply = () => patch.mutateAsync({ status: 'rescheduled', visitDate: String(x.date), visitTime: time24(String(x.time)), reason: String(x.reason || '') }).then(() => toast('🔄 Visit rescheduled'));
        const clash = cachedVisits.some((o) => o.id !== v.id && o.visitDate === x.date && time12(o.visitTime) === time12(time24(String(x.time))) && o.status !== 'cancelled');
        if (clash) askConfirm({ title: 'Schedule conflict', message: 'Another visit is already booked for ' + x.time + ' on that day.', confirmLabel: 'Schedule Anyway', onConfirm: apply });
        else await apply();
      },
    });
  };
  const saveLink = () => {
    const l = f.str('link').trim();
    if (!l) return void f.fail('link', 'Paste a meeting link');
    if (!isHttpsUrl(l)) return void f.fail('link', 'URL must start with https://');
    const platform = (PLATFORMS.find(([, base]) => base && l.startsWith(base))?.[2] ?? v.virtualPlatform ?? null) as VisitStatusBody['virtualPlatform'];
    patch.mutate(
      { meetingLink: l, virtualPlatform: platform },
      {
        onSuccess: () => {
          f.set('link', '');
          askConfirm({
            title: 'Send updated link to buyer?',
            message: '📱 Buyer will receive: "Virtual Visit Confirmed! 📅"',
            confirmLabel: 'Yes, notify',
            onConfirm: () => openCompose({ channel: 'whatsapp', name: v.buyerName, to: v.phone, entity, body: 'Virtual Visit Confirmed! 📅 Your virtual visit link: ' + l }),
          });
        },
      },
    );
  };
  const checklist = v.nriChecklist;

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/enquiries/visits"
      crumbs={crumbsFor('Enquiries', '/admin/enquiries/buy', 'Visits', '/admin/enquiries/visits', v.buyerName)}
      title={v.buyerName + ' — ' + date(v.visitDate + 'T12:00:00')}
      badges={[statusBadge(v.status), { text: virtual ? 'Virtual' : 'Physical', tone: virtual ? 'indigo' : 'muted' }]}
      meta={shortId(v.id, v.referenceId) + ' • ' + time12(v.visitTime) + ' • ' + v.propertyTitle}
      hActions={[...contactActions({ name: v.buyerName, phone: v.phone, email: v.email, property: v.propertyTitle, callLabel: 'Call Buyer', entity }), virtual ? btn('🎥 Join Virtual Call', join) : btn('🗺️ Get Directions', directions)]}
      banners={[
        lock,
        passed ? { text: 'This visit time has passed', tone: 'warn', actions: [{ label: 'Mark as Completed', onClick: complete }, { label: 'Mark as Missed', onClick: () => set('missed', '⚠️ Visit marked as missed') }] } : null,
        virtual && v.status === 'confirmed' && !hasLink ? { text: '⚠️ This visit is confirmed but has no meeting link. Add one immediately.', tone: 'error' } : null,
        v.status === 'cancelled' && v.cancelReason ? { text: 'Cancelled — ' + v.cancelReason, tone: 'error' } : null,
      ]}
      main={[
        {
          title: 'Visit Information',
          fields: [
            { label: 'Date', value: date(v.visitDate + 'T12:00:00'), strong: true },
            { label: 'Time', value: time12(v.visitTime), strong: true },
            { label: 'Type', value: virtual ? 'Virtual visit — meeting details below' : 'Physical' },
            { label: 'Assigned To', value: assigned || '⚠️ Unassigned' },
            { label: 'Address', value: v.propertyAddress },
          ],
        },
        v.rescheduleHistory.length
          ? { title: 'Reschedule History', rows: v.rescheduleHistory.map((h, i) => ({ key: String(i), title: date(h.previousDate + 'T12:00:00') + ' ' + time12(h.previousTime) + ' → ' + date(h.newDate + 'T12:00:00') + ' ' + time12(h.newTime), sub: (h.reason || 'No reason given') + (h.at ? ' · ' + relativeLong(h.at) : '') })) }
          : null,
        virtual
          ? {
              title: 'Virtual Meeting Details',
              tag: 'App screen: B-12, B-13',
              banners: v.meetingLink ? [{ text: 'Meeting Link Added ✅  ' + v.meetingLink, tone: 'success' }] : waVideo ? [{ text: 'WhatsApp video call selected — no link needed', tone: 'success' }] : [],
              chips: PLATFORMS.map(([n, base, platform]) => ({
                label: '+ ' + n,
                on: v.virtualPlatform === platform,
                onClick: () =>
                  n === 'WhatsApp'
                    ? askConfirm({
                        title: 'WhatsApp Video Call — no link needed',
                        message: 'Buyer will receive a WhatsApp video call at the scheduled time.',
                        confirmLabel: 'Use',
                        onConfirm: async () => {
                          await patch.mutateAsync({ virtualPlatform: 'whatsapp_video', meetingLink: null });
                          toast('WhatsApp video selected');
                        },
                      })
                    : f.set('link', base),
              })),
              form: v.meetingLink ? [] : [f.inp('link', 'Meeting link', { placeholder: 'Paste Zoom/Meet/Teams link here...', full: true })],
              actions: v.meetingLink
                ? [
                    btn('📋 Copy Link', () => void copyText(v.meetingLink!)),
                    btn('▶ Test Link', join),
                    btn('✏️ Edit', () => f.set('link', v.meetingLink!)),
                    btn('🗑 Remove', () => askConfirm({ title: 'Remove meeting link?', message: 'The buyer will need a new link.', confirmLabel: 'Remove', tone: 'destructive', onConfirm: async () => { await patch.mutateAsync({ meetingLink: null, virtualPlatform: null }); toast('Meeting link removed'); } }), 'red'),
                  ]
                : [btn('Save Link', saveLink, 'primary', { loading: patch.isPending })],
            }
          : null,
        virtual && v.meetingLink && f.str('link')
          ? { title: 'Edit meeting link', form: [f.inp('link', 'Meeting link', { full: true })], actions: [btn('Save Link', saveLink, 'primary'), btn('Cancel', () => f.set('link', ''))] }
          : null,
        {
          title: 'Visit Recording & Notes',
          banners: v.callNotes || v.recordingUrl ? [{ text: '✅ Call record saved — ' + (v.callDuration ?? 0) + ' min · ' + (v.callNotes || ''), tone: 'success' }] : [],
          form: [
            f.inp('rec.dur', 'Call Duration (minutes)', { type: 'number' }),
            f.inp('rec.url', 'Recording URL (optional)', { placeholder: 'https://…' }),
            f.inp('rec.notes', 'Call Notes', { type: 'textarea', required: true }),
            f.inp('rec.next', 'Follow-up Action', { type: 'select', options: FOLLOW_UPS }),
            f.inp('rec.date', 'Follow-up Date', { type: 'date', min: today }),
          ],
          actions: [
            btn('Save Call Record', () => {
              if (!f.need({ 'rec.notes': 'Call notes are required' })) return;
              if (!isHttpsUrl(f.str('rec.url'))) return void f.fail('rec.url', 'URL must start with https://');
              patch.mutate(
                { callDuration: Number(f.str('rec.dur')) || 0, virtualRecordingUrl: f.str('rec.url') || null, callNotes: f.str('rec.notes'), followUpAction: f.str('rec.next') || null, followUpDate: f.str('rec.date') || null },
                { onSuccess: () => { f.clear('rec.'); toast('📋 Call record saved'); } },
              );
            }, 'primary'),
          ],
        },
        v.userType !== 'resident'
          ? {
              title: 'NRI Support',
              tag: 'App: B-07, B-08',
              checks: NRI.map((label) => ({ label, done: !!checklist[label], onToggle: () => patch.mutate({ nriChecklist: { ...checklist, [label]: !checklist[label] } }) })),
            }
          : null,
        {
          title: 'Pre-Visit Checklist',
          subtitle: 'Complete before visit',
          checks: PRE.map((label) => ({ label, done: !!pre[label], onToggle: () => setPre((s) => ({ ...s, [label]: !s[label] })) })),
        },
        {
          title: 'Post-Visit Feedback',
          subtitle: 'Complete after visit',
          banners: v.feedback ? [{ text: 'Saved: ' + statusLabel(v.feedback.buyerInterest) + ' · Next: ' + (NEXT_OPTS.find(([k]) => k === v.feedback!.nextAction)?.[1] ?? statusLabel(v.feedback.nextAction)), tone: 'success' }] : [],
          form: [
            f.inp('fb.int', 'Buyer Interest', { type: 'select', required: true, options: INTEREST_OPTS.map(([value, label]) => ({ value, label })) }),
            f.inp('fb.next', 'Next Action', { type: 'select', required: true, options: NEXT_OPTS.map(([value, label]) => ({ value, label })) }),
            f.inp('fb.notes', 'Notes', { type: 'textarea', required: true, placeholder: 'How did the visit go? Buyer reactions...' }),
          ],
          actions: [
            btn('Save Feedback', () => {
              if (!f.need({ 'fb.int': 'Buyer interest is required', 'fb.next': 'Next action is required', 'fb.notes': 'Notes are required' })) return;
              feedback.mutate(
                { feedback: { buyerInterest: f.str('fb.int'), nextAction: f.str('fb.next'), notes: f.str('fb.notes') } },
                { onSuccess: () => { f.clear('fb.'); toast('✅ Feedback saved'); } },
              );
            }, 'primary', { loading: feedback.isPending }),
          ],
        },
      ]}
      side={[
        personSection('Buyer Info', { name: v.buyerName, phone: v.phone, email: v.email }, [{ label: 'User type', value: v.userType.toUpperCase() }], v.buyerId ? '/admin/users/' + v.buyerId : null, 'View Buyer Profile →', navigate),
        propertySection('Property Info', prop.data, { id: v.propertyId, title: v.propertyTitle, price: v.propertyPrice, type: v.propertyType, location: v.propertyAddress, image: v.propertyImage }, navigate),
        {
          title: 'Visit Actions',
          stack: true,
          actions: [
            btn('↗️ Reassign Visit', () =>
              modal.open({
                title: 'Reassign Visit',
                fields: [{ key: 'who', label: 'Assignee', type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), placeholder: 'Choose assignee…', required: true }],
                submit: 'Confirm Reassign',
                onSubmit: async (x) => {
                  await patch.mutateAsync({ assignedAdmin: String(x.who) });
                  toast('↗️ Reassigned to ' + (nameOf(String(x.who)) || 'team member'));
                },
              }),
            ),
            btn(v.status === 'confirmed' ? '✅ Already confirmed' : '✅ Confirm Visit', confirm, 'green', { disabled: v.status === 'confirmed' || v.status === 'completed' }),
            btn('✔️ Mark as Completed', complete),
            btn('⚠️ Mark as Missed', () => set('missed', '⚠️ Visit marked as missed')),
            btn('🔄 Reschedule Visit', reschedule),
            v.status === 'cancelled'
              ? null
              : btn('❌ Cancel Visit', () =>
                  askConfirm({
                    title: 'Cancel visit?',
                    message: (v.status === 'confirmed' ? 'Buyer already confirmed. Sure you want to cancel?\n\n' : '') + 'A push notification will be sent to the buyer.',
                    input: { label: 'Cancellation reason', placeholder: 'Reason' },
                    confirmLabel: 'Confirm Cancel',
                    tone: 'destructive',
                    onConfirm: async ({ value }) => {
                      await patch.mutateAsync({ status: 'cancelled', cancelReason: value, reason: value });
                      toast('❌ Visit cancelled — buyer notified');
                    },
                  }), 'red'),
          ],
        },
        {
          title: 'Quick Actions',
          stack: true,
          actions: [
            virtual ? btn(hasLink ? '🎥 Join Meeting' : '⚠️ Add Meeting Link First', () => (hasLink ? join() : toast('Add a meeting link in Virtual Meeting Details'))) : null,
            virtual && v.meetingLink ? btn('📤 Send Link to Buyer', () => openCompose({ channel: 'whatsapp', name: v.buyerName, to: v.phone, entity, body: 'Hi ' + first + ', join your virtual visit here: ' + v.meetingLink })) : null,
            btn('📤 Share Documents', () => openCompose({ channel: 'whatsapp', name: v.buyerName, to: v.phone, entity, title: 'Share Documents', body: 'Hi ' + first + ', sharing the brochure and floor plan for ' + v.propertyTitle + '.' })),
          ],
        },
        {
          title: 'Call Log',
          rows: v.callLogs.map((k) => ({ key: k.id, title: (k.outcome || 'Call') + (k.duration ? ' · ' + k.duration + ' min' : ''), sub: (k.notes ? k.notes + '\n' : '') + dateTime(k.at), badges: k.outcome ? [badge(k.outcome, k.outcome === 'Interested' ? 'green' : k.outcome === 'Not Interested' ? 'red' : 'muted')] : [] })),
          empty: v.callLogs.length ? '' : 'No call attempts yet — log your first call',
          chips: CALL_OUTCOMES.map((o) => ({ label: o, on: f.str('call.out') === o, onClick: () => { f.set('call.out', o); f.set('call.err', ''); } })),
          form: [f.inp('call.dur', 'Duration (minutes)', { type: 'number', placeholder: '5' }), f.inp('call.at', 'Called at', { type: 'datetime-local' }), f.inp('call.notes', 'Notes', { type: 'textarea', placeholder: 'What was discussed?' })],
          banners: f.str('call.err') ? [{ text: 'Select an outcome', tone: 'error' }] : [],
          actions: [
            btn('+ Log Call', () => {
              const out = f.str('call.out');
              if (!out) return f.set('call.err', '1');
              const at = f.str('call.at');
              patch.mutate({ callLog: { outcome: out, notes: f.str('call.notes'), duration: Number(f.str('call.dur')) || 0, calledAt: at ? new Date(at).toISOString() : new Date().toISOString() } }, { onSuccess: () => { f.clear('call.'); toast('📞 Call logged'); } });
            }, 'primary'),
          ],
        },
        {
          title: 'Notes',
          subtitle: 'Internal notes only',
          rows: v.notes.map((n) => ({ key: n.id, title: n.text, sub: relativeLong(n.at) })),
          empty: v.notes.length ? '' : 'No notes yet',
          formCols: 1,
          form: [f.inp('note', '', { type: 'textarea', placeholder: 'Add a note...' })],
          actions: [
            btn('Save Note', () => {
              const t = f.str('note').trim();
              if (!t) return void f.fail('note', 'Note cannot be empty');
              patch.mutate({ note: { text: t } }, { onSuccess: () => { f.set('note', ''); toast('📝 Note saved'); } });
            }, 'primary'),
          ],
        },
        wf.activity(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
