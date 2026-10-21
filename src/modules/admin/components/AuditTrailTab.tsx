import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { badge, dateTime, statusLabel } from '../../../lib/format';
import { listAuditLogs } from '../../../services/support';
import { toast } from '../../../store/uiStore';
import { ENTITY_ROUTE } from '../../../constants/entityRoutes';
import { downloadCsv } from '../../../lib/csv';

const D = 864e5;
/** Audit resource types that map onto a dashboard detail route. */
const RESOURCE_ROUTE: Record<string, string> = {
  ...ENTITY_ROUTE,
  buyenquiry: ENTITY_ROUTE.buy_enquiry!, sellrequest: ENTITY_ROUTE.sell_request!, salesdeal: ENTITY_ROUTE.sales_deal!, interiorlead: ENTITY_ROUTE.interior_lead!, supportticket: ENTITY_ROUTE.support_ticket!,
};

/** Admin › Audit Trail — GET /admin/audit-logs (latest 100), filtered by period / admin / action in the browser. */
export function AuditTrailTab() {
  const navigate = useNavigate();
  const f = useFormFields();
  const q = useQuery({ queryKey: ['audit-logs'], queryFn: ({ signal }) => listAuditLogs('', signal) });
  const all = q.data?.items ?? [];
  const per = f.str('a.per', 'week');
  const adm = f.str('a.adm');
  const act = f.str('a.act');
  const open = f.str('a.open');
  const start = per === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : per === 'week' ? Date.now() - 7 * D : per === 'month' ? Date.now() - 30 * D : f.str('a.from') ? Date.parse(f.str('a.from') + 'T00:00:00') : 0;
  const list = all.filter((a) => Date.parse(a.at) >= start && (!adm || a.admin === adm) && (!act || a.action === act));
  const routeOf = (rt: string, rid: string | null) => {
    const base = RESOURCE_ROUTE[rt] || RESOURCE_ROUTE[rt.toLowerCase().replace(/[^a-z]/g, '')];
    return base && rid ? base + rid : null;
  };

  return (
    <RecordDetailView
      state={q.isPending ? 'loading' : q.isError ? 'error' : 'ok'}
      isPage
      onRetry={() => void q.refetch()}
      errorTitle="Could not load the audit trail"
      title="Audit Trail"
      meta={'Every change made in the dashboard' + (q.data && q.data.total > all.length ? ' · showing latest ' + all.length + ' of ' + q.data.total : '')}
      single
      hActions={[
        btn('Export Audit Log', () => {
          if (!list.length) return toast('No audit entries to export');
          downloadCsv('audit-log.csv', ['Time', 'Admin', 'Action', 'Section', 'Description', 'Record', 'IP', 'Device', 'Before', 'After'], list.map((a) => [dateTime(a.at), a.admin, a.action, a.section, a.description, a.resourceId, a.ip, a.device, a.before, a.after]));
          toast('📥 Exporting ' + list.length + ' audit entries');
        }),
      ]}
      main={[
        {
          title: 'Filters',
          chips: [['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(([k, l]) => ({ label: l!, on: per === k, onClick: () => f.set('a.per', k!) })),
          form: [
            per === 'custom' ? f.inp('a.from', 'From', { type: 'date' }) : null,
            f.inp('a.adm', 'Admin', { type: 'select', options: [...new Set(all.map((a) => a.admin))], placeholder: 'All Admins' }),
            f.inp('a.act', 'Action', { type: 'select', options: [...new Set(all.map((a) => a.action))].map((x) => ({ value: x, label: statusLabel(x) })), placeholder: 'All Actions' }),
          ],
        },
        {
          title: 'Entries (' + list.length + ')',
          rows: list.slice(0, 80).map((a) => {
            const route = routeOf(a.resourceType, a.resourceId);
            return {
              key: a.id,
              title: a.description,
              sub: dateTime(a.at) + ' · ' + a.admin + ' · ' + a.section + (open === a.id ? '\nBefore: ' + (a.before ?? '—') + '\nAfter: ' + (a.after ?? '—') + '\nIP: ' + a.ip + ' · ' + a.device : ''),
              badges: [badge(statusLabel(a.action), 'muted')],
              actions: [{ label: open === a.id ? 'Hide' : 'Details', onClick: () => f.set('a.open', open === a.id ? '' : a.id) }, route ? { label: 'Open', onClick: () => navigate(route) } : null],
            };
          }),
          empty: list.length ? '' : 'No audit entries for this period',
        },
      ]}
    />
  );
}
