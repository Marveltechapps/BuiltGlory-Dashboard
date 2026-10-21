import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { saveBlob } from '../../../lib/apiClient';
import { listAdmins } from '../../../services/admins';
import { getSettings, updateSettings } from '../../../services/settings';
import { askConfirm, toast } from '../../../store/uiStore';
import type { AdminSettingsPatch } from '../../../types/settings';

type Tz = NonNullable<NonNullable<AdminSettingsPatch['display']>['timezone']>;
type Df = NonNullable<NonNullable<AdminSettingsPatch['display']>['dateFormat']>;

const TZ: Array<[Tz, string]> = [
  ['IST', 'IST (India Standard Time) UTC+5:30 — Recommended'], ['GST', 'GST (Gulf Standard Time) UTC+4'], ['SGT', 'SGT (Singapore) UTC+8'],
  ['GMT', 'GMT (London) UTC+0'], ['EST', 'EST (New York) UTC-5'], ['PST', 'PST (Los Angeles) UTC-8'],
];
const DF: Array<[Df, string]> = [['DD MMM YYYY', 'DD MMM YYYY (DEFAULT — Indian)'], ['DD/MM/YYYY', 'DD/MM/YYYY'], ['MMM DD, YYYY', 'MMM DD, YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD']];
const CUR: Array<['indian' | 'international', string]> = [['indian', 'Indian (₹1,00,000) — DEFAULT'], ['international', 'International (₹100,000)']];
const EMAIL = /^\S+@\S+\.\S+$/;
const opts = <T extends string>(list: Array<[T, string]>) => list.map(([value, label]) => ({ value, label }));

/** Admin › Settings — GET / PATCH /admin/settings (organization, display, app, sla, alerts, notifications). */
export function GeneralSettingsTab() {
  const f = useFormFields();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: ({ signal }) => getSettings(signal), retry: false });
  const adminsQ = useQuery({ queryKey: ['admins'], queryFn: ({ signal }) => listAdmins(signal), retry: false });
  const save = useRefreshingMutation((b: AdminSettingsPatch) => updateSettings(b), [['admin-settings']]);
  const st = q.data;
  if (!st) return <RecordDetailView state={q.isError ? 'error' : 'loading'} isPage onRetry={() => void q.refetch()} errorTitle="Could not load settings" />;

  const o = st.organization;
  const sla = st.sla;
  const c = st.notifications.contact;
  const slaTab = f.str('slaT', 'interior');
  const escalators = (adminsQ.data ?? []).filter((a) => ['super_admin', 'admin'].includes(a.role));
  const emailOn = Object.values(st.notifications.email).some(Boolean) || !Object.keys(st.notifications.email).length;
  const waOn = Object.values(st.notifications.whatsapp).some(Boolean) || !Object.keys(st.notifications.whatsapp).length;
  const apply = (body: AdminSettingsPatch, msg: string) => save.mutate(body, { onSuccess: () => toast('✅ ' + msg) });
  const v = (k: string, d: string) => f.str(k, d).trim();
  const b = (k: string, d: boolean) => !!f.val<boolean>(k, d);

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Settings"
      meta="Company, display, app and SLA configuration"
      single
      banners={[st.app.maintenance ? { text: 'App is in maintenance mode — users cannot access the app.', tone: 'error' } : null]}
      main={[
        {
          title: 'Company Information',
          form: [
            f.inp('co.n', 'Company Name', { default: o.name }),
            f.inp('co.t', 'Tagline', { default: o.tagline }),
            f.inp('co.e', 'Email', { default: o.email }),
            f.inp('co.p', 'Phone', { default: o.phone }),
            f.inp('co.a', 'Address', { type: 'textarea', default: o.address }),
          ],
          actions: [
            btn('Save Company Info', () => {
              const email = v('co.e', o.email);
              if (email && !EMAIL.test(email)) return void f.fail('co.e', 'Enter a valid email');
              apply({ organization: { name: v('co.n', o.name), tagline: v('co.t', o.tagline), email, phone: v('co.p', o.phone), address: v('co.a', o.address) } }, 'Company info saved');
            }, 'primary', { loading: save.isPending }),
          ],
        },
        {
          title: 'Display Settings',
          form: [
            f.inp('ds.tz', 'Dashboard Timezone', { type: 'select', options: opts(TZ), default: st.display.timezone, hint: 'Affects how dates and times are displayed across dashboard' }),
            f.inp('ds.df', 'Date Display Format', { type: 'select', options: opts(DF), default: st.display.dateFormat }),
            f.inp('ds.cur', 'Currency Display', { type: 'select', options: opts(CUR), default: st.display.currencyFormat }),
          ],
          actions: [
            btn('Save Display Settings', () => apply({ display: { timezone: v('ds.tz', st.display.timezone) as Tz, dateFormat: v('ds.df', st.display.dateFormat) as Df, currencyFormat: v('ds.cur', st.display.currencyFormat) as 'indian' } }, 'Display settings saved'), 'primary', { loading: save.isPending }),
          ],
        },
        {
          title: 'App Configuration',
          form: [f.inp('mm', 'App Maintenance Mode — Show maintenance screen to users', { type: 'checkbox', default: st.app.maintenance })],
          actions: [
            btn('Save App Configuration', () => {
              const on = b('mm', st.app.maintenance);
              if (on === st.app.maintenance) return toast('No changes');
              askConfirm({
                title: 'Confirm Update',
                message: on ? 'Users will see the maintenance screen until you turn this off.' : 'The app will be available to users again.',
                confirmLabel: 'Confirm Update',
                tone: on ? 'destructive' : 'primary',
                onConfirm: () => save.mutateAsync({ app: { maintenance: on } }).then(() => toast(on ? '✅ Maintenance mode ON' : '✅ Maintenance mode OFF')),
              });
            }, 'primary', { loading: save.isPending }),
          ],
        },
        {
          title: 'SLA Configuration',
          chips: [['interior', 'Interior'], ['stage', 'Stage Payment'], ['enquiry', 'Enquiry Response']].map(([k, label]) => ({ label: label!, on: slaTab === k, onClick: () => f.set('slaT', k!) })),
          form: [
            slaTab === 'interior' ? f.inp('sla.i', 'Interior Inquiry Response Time (hours)', { type: 'number', default: String(sla.interiorHours) }) : null,
            slaTab === 'stage' ? f.inp('sla.s', 'Stage Payment Response Time (hours)', { type: 'number', default: String(sla.stagePaymentHours) }) : null,
            slaTab === 'enquiry' ? f.inp('sla.e', 'Buyer Enquiry Response SLA (hours)', { type: 'number', default: String(sla.enquiryHours), hint: 'Maximum time to respond to a new buy enquiry' }) : null,
            f.inp('sla.esc', 'Auto-escalate tickets open > 48hrs', { type: 'checkbox', default: sla.autoEscalate }),
            f.inp('sla.to', 'Escalate to', { type: 'select', options: escalators.map((a) => ({ value: a.id, label: a.name })), placeholder: sla.escalateToName || 'Select admin', default: sla.escalateToAdminId || '' }),
            f.inp('sla.daily', 'Daily summary (email)', { type: 'checkbox', default: st.alerts.triggers.dailyEmail ?? true }),
            f.inp('sla.weekly', 'Weekly analytics (email)', { type: 'checkbox', default: st.alerts.triggers.weeklyEmail ?? false }),
          ],
          banners: [{ text: 'Changes update the Overview SLA cards immediately.', tone: 'muted' }],
          actions: [
            btn('Save Alert Settings', () => {
              const n = (k: string, d: number) => Number(f.str(k, String(d)));
              const hours = { interiorHours: n('sla.i', sla.interiorHours), stagePaymentHours: n('sla.s', sla.stagePaymentHours), enquiryHours: n('sla.e', sla.enquiryHours) };
              if (Object.values(hours).some((x) => !Number.isInteger(x) || x < 1 || x > 168)) return toast('SLA hours must be whole numbers between 1 and 168');
              const toId = f.str('sla.to', sla.escalateToAdminId || '');
              const toName = escalators.find((a) => a.id === toId)?.name ?? sla.escalateToName;
              apply(
                {
                  sla: { ...hours, autoEscalate: b('sla.esc', sla.autoEscalate), escalateToAdminId: toId || null, escalateToName: toName },
                  alerts: { triggers: { ...st.alerts.triggers, dailyEmail: b('sla.daily', st.alerts.triggers.dailyEmail ?? true), weeklyEmail: b('sla.weekly', st.alerts.triggers.weeklyEmail ?? false) } },
                },
                'SLA settings saved',
              );
            }, 'primary', { loading: save.isPending }),
          ],
        },
        {
          title: 'Admin Contact Details',
          subtitle: 'These details receive admin notifications for SLA breaches, new enquiries, and system alerts',
          form: [
            f.inp('ac.w', 'Admin WhatsApp Number', { default: c.phone }),
            f.inp('ac.e', 'Admin Email Address', { default: c.email }),
            f.inp('ac.cc', 'CC Email (optional)', { default: c.ccEmail, placeholder: 'manager@builtglory.com' }),
            f.inp('ac.en', 'Email notifications', { type: 'checkbox', default: emailOn }),
            f.inp('ac.wn', 'WhatsApp notifications', { type: 'checkbox', default: waOn }),
          ],
          actions: [
            btn('Save Contact Details', () => {
              const e = v('ac.e', c.email);
              const cc = v('ac.cc', c.ccEmail);
              if (e && !EMAIL.test(e)) return void f.fail('ac.e', 'Enter a valid email');
              if (cc && !EMAIL.test(cc)) return void f.fail('ac.cc', 'Enter a valid email');
              const en = b('ac.en', emailOn);
              const wn = b('ac.wn', waOn);
              apply(
                {
                  notifications: {
                    contact: { phone: v('ac.w', c.phone), email: e, ccEmail: cc },
                    email: Object.fromEntries(['enquiry', 'sell', 'kyc', 'user', 'stageProof', 'ticket'].map((k) => [k, en])),
                    whatsapp: { enquiry: wn, slaBreached: wn },
                  },
                },
                'Contact details saved',
              );
            }, 'primary', { loading: save.isPending }),
          ],
        },
        {
          title: 'Settings Data',
          subtitle: st.updatedAt ? 'Last saved ' + new Date(st.updatedAt).toLocaleString('en-IN') : undefined,
          actions: [
            btn('Reload Saved Settings', () => {
              f.reset();
              void q.refetch().then(() => toast('Reloaded saved settings'));
            }),
            btn('Export Settings JSON', () => {
              saveBlob(new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' }), 'builtglory-settings.json');
              toast('📥 Settings exported');
            }),
          ],
        },
      ]}
    />
  );
}
