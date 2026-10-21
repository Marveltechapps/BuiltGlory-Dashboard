import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { useViewport } from '../../../hooks/useViewport';
import { price } from '../../../lib/format';
import { EnquiriesChart } from '../components/EnquiriesChart';
import { PropertiesDonut } from '../components/PropertiesDonut';
import { ActivityFeed, KpiCard, Panel, PendingApprovalsTable, RecentEnquiriesTable, SlaCard, TodaySchedule } from '../components/OverviewWidgets';
import { PingDot } from '../../../components/ui/Skeleton';
import { useOverview } from '../hooks/useOverview';
import styles from '../components/Overview.module.css';

export function OverviewPage() {
  const navigate = useNavigate();
  const { isSm, isMd, isLg, isXl } = useViewport();
  const { data: ov, isPending, isError, refetch, isFetching } = useOverview();
  const loading = isPending || (isFetching && !ov);
  const error = !loading && isError;

  const kpis = ov?.kpis ?? {};
  const sales = ov?.pipelineCounts?.sales ?? [];
  const pc = (vals: string[]) => sales.filter((x) => vals.includes(String(x.value))).reduce((t, x) => t + (x.count || 0), 0);
  const activeDeals = pc(['active_leads', 'site_visits', 'negotiation', 'token_payment', 'documentation', 'interior_design', 're_engagement']);
  const q = { enquiries: ov?.slaQueues?.enquiries ?? [], interiorLeads: ov?.slaQueues?.interiorLeads ?? [], stagePayments: ov?.slaQueues?.stagePayments ?? [] };

  const L = {
    heroPad: isMd ? 28 : 24,
    quickCols: isSm ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)',
    kpiCols: isLg ? 'repeat(4, minmax(0, 1fr))' : isSm ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
    kpiSize: isMd ? 30 : 24,
    twoCols: isLg ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
    slaCols: isXl ? 'repeat(3, minmax(0, 1fr))' : isLg ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner} style={{ padding: L.heroPad }}>
          <div className={styles.heroGlow} />
          <div className={styles.heroRow} style={{ flexDirection: isLg ? 'row' : 'column', alignItems: isLg ? 'center' : 'stretch' }}>
            <div>
              <p className={styles.eyebrow}>Admin Command Center</p>
              <h1 className={styles.heroTitle}>BuiltGlory Overview</h1>
              <p className={styles.heroText}>Monitor enquiries, sales movement, acquisition health, revenue, and SLA response risk from one workspace.</p>
              <div className={styles.status}>
                {loading && (
                  <span className={styles.pill} style={{ background: '#f1f5f9', color: '#64748b' }}>Loading backend overview</span>
                )}
                {!loading && !error && (
                  <span className={styles.pill} style={{ background: '#f0fdf4', fontWeight: 500, color: '#15803d' }}><Icon name="check-circle" size={12} />Live backend overview</span>
                )}
                {error && (
                  <>
                    <span className={styles.pill} style={{ background: '#fef2f2', fontWeight: 500, color: '#b91c1c' }}><Icon name="alert-circle" size={12} />Could not load dashboard overview.</span>
                    <button type="button" className={styles.retry} onClick={() => void refetch()}><Icon name="refresh-cw" size={12} />Retry</button>
                  </>
                )}
              </div>
            </div>
            <div className={styles.quick} style={{ gridTemplateColumns: L.quickCols }}>
              <button type="button" className={styles.quickBtn} onClick={() => navigate('/admin/enquiries/buy')}>
                <span className={styles.quickVal}>{kpis.newEnquiries ?? q.enquiries.length}</span>
                <span className={styles.quickLbl}>New enquiries</span>
              </button>
              <button type="button" className={styles.quickBtn} onClick={() => navigate('/admin/sales/stagepayment')}>
                <span className={styles.quickVal}>{kpis.tokenPaidDeals ?? q.stagePayments.length}</span>
                <span className={styles.quickLbl}>Stage payments</span>
              </button>
              <button type="button" className={styles.quickBtn} onClick={() => navigate('/admin/enquiries/interior')}>
                <span className={styles.quickVal}>{q.interiorLeads.length}</span>
                <span className={styles.quickLbl}>Interior SLAs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.grid} style={{ alignItems: 'stretch', gridTemplateColumns: L.kpiCols }}>
        <KpiCard loading={loading} label="Total Properties" value={String(kpis.activeProperties ?? 0)} subtitle={(kpis.featuredProperties ?? 0) + ' featured · ' + (kpis.upcomingProperties ?? 0) + ' upcoming'} icon="building-2" gradient="linear-gradient(to bottom right, #3b82f6, #2563eb)" to="/admin/properties/all" valueSize={L.kpiSize} />
        <KpiCard loading={loading} label="Total Enquiries" value={String(kpis.newEnquiries ?? q.enquiries.length)} subtitle={(kpis.overdueCallbacks ?? 0) + ' overdue callbacks · ' + (kpis.openSupportTickets ?? 0) + ' open tickets'} icon="message-square" gradient="linear-gradient(to bottom right, #22c55e, #16a34a)" to="/admin/enquiries/buy" valueSize={L.kpiSize} />
        <KpiCard loading={loading} label="Active Deals" value={String(activeDeals)} subtitle={pc(['negotiation']) + ' in negotiation · ' + (kpis.closedDeals ?? 0) + ' closed'} icon="handshake" gradient="linear-gradient(to bottom right, #f97316, #ea580c)" to="/admin/sales/all" valueSize={L.kpiSize} />
        <KpiCard loading={loading} label="Revenue This Month" value={price(kpis.revenue ?? 0)} subtitle="Backend reported revenue" icon="trending-up" gradient="linear-gradient(to bottom right, #a855f7, #9333ea)" to="/admin/reports/revenue" valueSize={L.kpiSize} />
      </div>

      <section className={styles.section}>
        <div className={styles.secHead}>
          <div>
            <h2 className={styles.secTitle}>Performance Snapshot</h2>
            <p className={styles.secSub}>Demand trends and portfolio distribution</p>
          </div>
          <button type="button" className="bg-link-btn" onClick={() => navigate('/admin/reports/sales')}>Open reports →</button>
        </div>
        <div className={styles.grid} style={{ gridTemplateColumns: L.twoCols }}>
          <Panel title="Enquiries Over Last 7 Days">
            <div style={{ padding: 20 }}><EnquiriesChart data={ov?.chartSeries?.enquiriesLast7Days ?? []} /></div>
          </Panel>
          <Panel title="Properties by Type">
            <div style={{ padding: 20 }}><PropertiesDonut data={ov?.chartSeries?.propertiesByType ?? []} /></div>
          </Panel>
        </div>
      </section>

      <section className={styles.section}>
        <div>
          <h2 className={styles.secTitle}>Operational Queue</h2>
          <p className={styles.secSub}>New enquiries and approvals waiting for action</p>
        </div>
        <div className={styles.grid} style={{ gridTemplateColumns: L.twoCols }}>
          <Panel title="Recent Enquiries" footer={<div className={styles.panelFoot}><button type="button" className="bg-link-btn" onClick={() => navigate('/admin/enquiries/buy')}>View All →</button></div>}>
            <RecentEnquiriesTable rows={ov?.recentEnquiries ?? []} loading={loading} />
          </Panel>
          <Panel title="Pending Approvals" footer={<div className={styles.panelFoot}><button type="button" className="bg-link-btn" onClick={() => navigate('/admin/enquiries/sell')}>View All →</button></div>}>
            <PendingApprovalsTable rows={ov?.pendingApprovals ?? []} loading={loading} />
          </Panel>
        </div>
      </section>

      <section className={styles.section}>
        <div>
          <h2 className={styles.secTitle}>Live Workspace</h2>
          <p className={styles.secSub}>Real-time activity and today&apos;s schedule</p>
        </div>
        <div className={styles.grid} style={{ gridTemplateColumns: L.twoCols }}>
          <Panel
            title="Real-time App Activity"
            right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: '16px', color: '#64748b' }}><PingDot />Live</span>}
            footer={<div className={styles.panelFoot} style={{ padding: '0 20px 20px' }}><button type="button" className="bg-link-btn" onClick={() => navigate('/admin/settings/audit')}>View All Events →</button></div>}
          >
            <ActivityFeed items={ov?.recentActivities ?? []} loading={loading} />
          </Panel>
          <TodaySchedule visits={ov?.schedule ?? []} loading={loading} />
        </div>
      </section>

      <section className={styles.section}>
        <div style={{ marginBottom: 16 }}>
          <h2 className={styles.secTitle}>SLA Tracker</h2>
          <p className={styles.secSub}>Response time monitoring</p>
        </div>
        <div className={styles.grid} style={{ gridTemplateColumns: L.slaCols }}>
          <SlaCard loading={loading} title="Interior Inquiries" subtitle="24hr response SLA" icon="clock" iconColor="#f97316" list={q.interiorLeads} viewAllHref="/admin/enquiries/interior" viewAllLabel="View All Interior Leads →" call />
          <SlaCard loading={loading} title="Stage Payment Requests" subtitle="4hr response SLA" icon="credit-card" iconColor="#3b82f6" list={q.stagePayments} viewAllHref="/admin/sales/stagepayment" viewAllLabel="View All Stage Payments →" />
          <SlaCard loading={loading} title="Enquiry Response SLA" subtitle="2hr response SLA" icon="message-square" iconColor="#22c55e" list={q.enquiries} viewAllHref="/admin/enquiries/buy" viewAllLabel="Enquiries → Buy Enquiries" />
        </div>
      </section>
    </div>
  );
}
