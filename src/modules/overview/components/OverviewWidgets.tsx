import type { KeyboardEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton, SkeletonRows } from '../../../components/ui/Skeleton';
import { callPhone } from '../../../lib/contact';
import { addDaysIso, date, initials, isoDay, parseTimeMinutes, relative, statusLabel, todayIso } from '../../../lib/format';
import type { AdminOverview, OverviewSlaItem } from '../../../types/overview';
import styles from './Overview.module.css';

export function KpiCard({ label, value, subtitle, icon, gradient, to, valueSize, loading }: { label: string; value: string; subtitle: string; icon: string; gradient: string; to: string; valueSize: number; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <div role="button" tabIndex={0} className={styles.kpiWrap} onClick={() => navigate(to)} onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && navigate(to)}>
      <div className={styles.kpi}>
        <div className={styles.kpiBody}>
          <div className={styles.kpiBar} />
          <div className={styles.kpiText}>
            <div>
              <p className={styles.kpiLabel}>{label}</p>
              {loading ? <Skeleton style={{ height: valueSize, width: '55%', borderRadius: 8, marginTop: 8 }} /> : <p className={styles.kpiValue} style={{ fontSize: valueSize }}>{value}</p>}
            </div>
            {loading ? <Skeleton style={{ height: 12, width: '80%', borderRadius: 6, marginTop: 10 }} /> : <p className={styles.kpiSub}>{subtitle}</p>}
          </div>
          <div className={styles.kpiIcon} style={{ background: gradient }}><Icon name={icon} size={24} /></div>
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, right, children, footer }: { title: string; right?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className={styles.panel}>
      {right ? (
        <div className={styles.panelHead} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className={styles.panelTitle}>{title}</h3>
          {right}
        </div>
      ) : (
        <div className={styles.panelHead}><h3 className={styles.panelTitle}>{title}</h3></div>
      )}
      {children}
      {footer}
    </div>
  );
}

const enquiryBadge = (s: string): [string, string] => (s === 'new' ? ['#dbeafe', '#1d4ed8'] : s === 'responded' || s === 'closed' ? ['#dcfce7', '#15803d'] : ['#ffedd5', '#c2410c']);

export function RecentEnquiriesTable({ rows, loading }: { rows: NonNullable<AdminOverview['recentEnquiries']>; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} style={{ minWidth: 520 }}>
        <thead>
          <tr className={styles.thead}>
            <th className={styles.th}>Buyer Name</th>
            <th className={styles.th}>Property</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Date</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th} style={{ paddingRight: 0 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && loading && <tr><td colSpan={6} className={styles.td}><SkeletonRows count={3} /></td></tr>}
          {rows.length === 0 && !loading && <tr><td colSpan={6} className={styles.tdEmpty}>No recent buy enquiries</td></tr>}
          {rows.map((r, i) => {
            const [bg, fg] = enquiryBadge(r.status);
            return (
              <tr key={r.id} className={styles.tr} style={{ borderBottom: i === rows.length - 1 ? 0 : '1px solid rgba(226,232,240,0.6)' }} onClick={() => navigate(r.viewPath)}>
                <td className={styles.td} style={{ fontWeight: 500 }}>{r.buyer}</td>
                <td className={styles.td} style={{ color: '#64748b' }}>{r.property}</td>
                <td className={styles.td}>{r.type}</td>
                <td className={styles.td} style={{ color: '#64748b' }}>{date(r.date)}</td>
                <td className={styles.td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500, background: bg, color: fg }}>{statusLabel(r.status)}</span>
                </td>
                <td style={{ padding: '12px 0' }} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={styles.rowBtn} onClick={() => navigate(r.viewPath)}>View →</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PendingApprovalsTable({ rows, loading }: { rows: NonNullable<AdminOverview['pendingApprovals']>; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} style={{ minWidth: 480 }}>
        <thead>
          <tr className={styles.thead}>
            <th className={styles.th}>Seller</th>
            <th className={styles.th}>Property Title</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Submitted</th>
            <th className={styles.th} style={{ paddingRight: 0 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && loading && <tr><td colSpan={5} className={styles.td}><SkeletonRows count={3} /></td></tr>}
          {rows.length === 0 && !loading && <tr><td colSpan={5} className={styles.tdEmpty}>No pending seller approvals</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.id} className={styles.tr} style={{ borderBottom: i === rows.length - 1 ? 0 : '1px solid rgba(226,232,240,0.6)' }} onClick={() => navigate(r.viewPath)}>
              <td className={styles.td} style={{ fontWeight: 500 }}>{r.seller}</td>
              <td className={styles.td}>{r.title}</td>
              <td className={styles.td} style={{ color: '#64748b' }}>{r.type}</td>
              <td className={styles.td} style={{ color: '#64748b' }}>{date(r.submitted)}</td>
              <td style={{ padding: '12px 0' }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.rowBtn} onClick={() => navigate(r.viewPath)}>Review →</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const deco = (type?: string): [string, string, string] => {
  const t = String(type || '').toLowerCase();
  if (t.includes('user')) return ['user-plus', '#dcfce7', '#16a34a'];
  if (t.includes('property') || t.includes('sell')) return ['building-2', '#fef3c7', '#d97706'];
  if (t.includes('sales') || t.includes('payment')) return ['credit-card', '#f3e8ff', '#9333ea'];
  if (t.includes('enquiry') || t.includes('support')) return ['message-square', '#dbeafe', '#2563eb'];
  return ['activity', '#f1f5f9', '#64748b'];
};

export function ActivityFeed({ items, loading }: { items: NonNullable<AdminOverview['recentActivities']>; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 16, padding: 20 }}>
      {items.length === 0 && loading && <SkeletonRows count={4} />}
      {items.length === 0 && !loading && (
        <div style={{ borderRadius: 12, border: '1px dashed #e2e8f0', padding: 24, textAlign: 'center', fontSize: 14, lineHeight: '20px', color: '#64748b' }}>No recent audit activity yet</div>
      )}
      {items.map((a) => {
        const [icon, bg, fg] = deco(a.resourceType);
        return (
          <button key={a.id} type="button" className={styles.act} onClick={() => navigate(a.route || '/admin/settings/audit')}>
            <span className={styles.actIcon} style={{ background: bg, color: fg }}><Icon name={icon} size={16} /></span>
            <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, lineHeight: 1.375 }}>{a.description}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{relative(a.time)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const VISIT_STATUS: Record<string, [string, string]> = {
  scheduled: ['#dbeafe', '#1e40af'], confirmed: ['#dcfce7', '#166534'], completed: ['#f1f5f9', '#64748b'],
  cancelled: ['#fee2e2', '#991b1b'], missed: ['#ffedd5', '#9a3412'], rescheduled: ['#f3e8ff', '#6b21a8'],
};

export function TodaySchedule({ visits, loading }: { visits: NonNullable<AdminOverview['schedule']>; loading: boolean }) {
  const navigate = useNavigate();
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const dayOf = (v: string) => isoDay(v);
  const todayVisits = visits.filter((v) => dayOf(v.visitDate) === today && v.status !== 'cancelled').sort((a, b) => parseTimeMinutes(a.visitTime) - parseTimeMinutes(b.visitTime));
  const tomorrowVisits = visits.filter((v) => dayOf(v.visitDate) === tomorrow && v.status !== 'cancelled');
  const byTime: Record<string, number> = {};
  todayVisits.forEach((v) => (byTime[v.visitTime] = (byTime[v.visitTime] || 0) + 1));
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const headerDate = new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={styles.panel}>
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h3 className={styles.panelTitle}>Today&apos;s Schedule</h3>
            <p style={{ marginTop: 2, fontSize: 14, lineHeight: '20px', color: '#64748b' }}>{headerDate}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: '#f1f5f9', padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500, color: '#64748b' }}>{todayVisits.length} visits</span>
            <button type="button" className="bg-link-btn" onClick={() => navigate('/admin/enquiries/visits')}>View All →</button>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: 20 }}>
        {todayVisits.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todayVisits.map((v) => {
              const isPast = parseTimeMinutes(v.visitTime) < nowMins;
              const [sbg, sfg] = VISIT_STATUS[v.status] || ['#f1f5f9', '#64748b'];
              const overdue = isPast && (v.status === 'scheduled' || v.status === 'confirmed');
              const open = () => navigate(v.viewPath);
              return (
                <li key={v.id} role="button" tabIndex={0} className={styles.visit} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
                  <span className={styles.timeChip} style={{ background: isPast ? '#f1f5f9' : '#dbeafe', color: isPast ? '#64748b' : '#1e40af' }}>{v.visitTime}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontWeight: 500 }}>{v.buyerName}</p>
                    <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, lineHeight: '20px', color: '#64748b' }}>{v.propertyTitle}</p>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <span className={styles.smallPill} style={{ background: '#f1f5f9', color: '#64748b' }}>
                        <Icon name={v.visitType === 'virtual' ? 'video' : 'map-pin'} size={12} />
                        {v.visitType === 'virtual' ? 'Virtual' : 'Physical'}
                      </span>
                      <span className={styles.smallPill} style={{ fontWeight: 500, textTransform: 'capitalize', background: sbg, color: sfg }}>{v.status}</span>
                      {(byTime[v.visitTime] || 0) > 1 && <span className={styles.smallPill} style={{ background: '#ffedd5', fontWeight: 500, color: '#c2410c' }}>Conflict</span>}
                      {overdue && (
                        <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500, color: '#c2410c' }}>
                          Overdue <button type="button" style={{ textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); open(); }}>Mark</button>
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" className="bg-link-btn" style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); open(); }}>View →</button>
                </li>
              );
            })}
          </ul>
        )}
        {todayVisits.length === 0 && loading && <div style={{ padding: '12px 20px' }}><SkeletonRows count={3} /></div>}
        {todayVisits.length === 0 && !loading && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 14, lineHeight: '20px', color: '#64748b' }}>No visits today</p>
            {tomorrowVisits.length > 0 ? (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <p style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>Tomorrow: {tomorrowVisits.length} visit{tomorrowVisits.length > 1 ? 's' : ''}</p>
                <ul style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tomorrowVisits.slice(0, 3).map((v) => <li key={v.id} style={{ fontSize: 14, lineHeight: '20px', color: '#64748b' }}>{v.visitTime} — {v.buyerName}</li>)}
                </ul>
              </div>
            ) : (
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b' }}>
                <span style={{ display: 'inline-flex', marginBottom: 8, opacity: 0.4 }}><Icon name="calendar-off" size={40} /></span>
                <p style={{ fontSize: 14, lineHeight: '20px' }}>No upcoming visits scheduled</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TONE_COLOR = { green: '#16a34a', orange: '#d97706', red: '#dc2626' };

function slaLabel(item: OverviewSlaItem): { text: string; tone: keyof typeof TONE_COLOR } {
  const r = item.remainingHours;
  if (r <= 0) {
    const o = Math.abs(r);
    if (o < 1) return { text: 'OVERDUE just now', tone: 'red' };
    return { text: 'OVERDUE ' + Math.max(1, Math.round(o)) + 'hrs ago', tone: 'red' };
  }
  return { text: Math.max(1, Math.round(r)) + 'hr remaining', tone: item.status === 'warning' ? 'orange' : 'green' };
}

interface SlaCardProps {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  list: OverviewSlaItem[];
  viewAllHref: string;
  viewAllLabel: string;
  call?: boolean;
}

export function SlaCard({ title, subtitle, icon, iconColor, list, viewAllHref, viewAllLabel, call, loading }: SlaCardProps & { loading?: boolean }) {
  const navigate = useNavigate();
  const top3 = list.slice(0, 3);
  const progress = top3[0] ? top3[0].progressPercent : 0;
  const bar = progress >= 100 ? '#ef4444' : progress >= 80 ? '#f59e0b' : '#22c55e';
  return (
    <div className={styles.sla}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h3 style={{ fontWeight: 600 }}>{title}</h3>
          <p style={{ fontSize: 14, lineHeight: '20px', color: '#64748b' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: '#f1f5f9', color: iconColor }}><Icon name={icon} size={20} /></div>
          {list.length > 0 && <span style={{ whiteSpace: 'nowrap', borderRadius: 9999, background: '#f1f5f9', padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500 }}>{list.length} pending</span>}
        </div>
      </div>
      {list.length === 0 && loading ? <SkeletonRows count={3} /> : list.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', marginBottom: 8, color: '#16a34a' }}><Icon name="check-circle" size={40} stroke={1.5} /></span>
          <p style={{ fontWeight: 500, color: '#16a34a' }}>All clear! No pending inquiries</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: '16px', color: '#64748b' }}>
              <span>SLA usage</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 8, overflow: 'hidden', borderRadius: 9999, background: '#f1f5f9' }}>
              <div style={{ height: '100%', borderRadius: 9999, transition: 'all 150ms', width: Math.min(100, progress) + '%', background: bar }} />
            </div>
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map((it) => {
              const lb = slaLabel(it);
              const isCall = call && !!it.phone;
              return (
                <li key={it.id} className={styles.slaItem}>
                  <button type="button" onClick={() => navigate(it.viewPath)} style={{ display: 'flex', minWidth: 0, flex: 1, cursor: 'pointer', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                    <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'flex', width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#f1f5f9', fontSize: 12, lineHeight: '16px', fontWeight: 600 }}>{initials(it.name)}</span>
                      <span style={{ display: 'block', minWidth: 0 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>{it.name}</span>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{it.property}</span>
                      </span>
                    </span>
                  </button>
                  <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500, color: TONE_COLOR[lb.tone] }}>{lb.text}</span>
                    <button type="button" className={styles.slaBtn} onClick={() => (isCall ? callPhone(it.name, it.phone) : navigate(it.viewPath))}>{isCall ? 'Call' : 'View'}</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length > 3 && (
            <button type="button" onClick={() => navigate(viewAllHref)} style={{ marginTop: 8, fontSize: 12, lineHeight: '16px', fontWeight: 500, color: '#2563eb' }}>+ {list.length - 3} more</button>
          )}
        </>
      )}
      <Link to={viewAllHref} className={styles.slaAll}>{viewAllLabel}</Link>
    </div>
  );
}
