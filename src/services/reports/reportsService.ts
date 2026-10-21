import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { arr, asRaw, idOf, iso, num, str, type Raw } from '../../lib/raw';
import type { AcquisitionAnalytics, ExportFormat, ExportReportType, ReportExport, RevenueAnalytics, SalesAnalytics } from '../../types/reports';

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  propertyType?: string;
}

const n = (v: unknown) => num(v) ?? 0;
const nOrNull = (v: unknown) => (v == null ? null : num(v));
function list<T>(v: unknown, map: (x: Raw) => T): T[] {
  return arr(v).map((x) => map(asRaw(x)));
}

/** GET /api/v1/admin/reports/sales/analytics?from&to&propertyType */
export async function getSalesAnalytics(query: AnalyticsQuery, signal?: AbortSignal): Promise<SalesAnalytics> {
  const d = asRaw(await apiRequest<Raw>('/v1/admin/reports/sales/analytics', { query: { ...query }, signal }));
  const s = asRaw(d.stats);
  return {
    stats: { count: n(s.count), revenue: n(s.revenue), averageDealValue: n(s.averageDealValue), conversion: n(s.conversion), pipelineCount: nOrNull(s.pipelineCount), pipelineValue: nOrNull(s.pipelineValue) },
    monthlyClosedDeals: list(d.monthlyClosedDeals, (x) => ({ month: str(x.month), deals: n(x.deals), revenue: n(x.revenue) })),
    monthlyDealActivity: list(d.monthlyDealActivity, (x) => ({ month: str(x.month), deals: n(x.deals) })),
    revenueByType: list(d.revenueByTypeAll ?? d.revenueByType, (x) => ({ type: str(x.type), revenue: n(x.revenue), deals: n(x.deals) })),
    pipelineByStage: list(d.pipelineByStage, (x) => ({ stage: str(x.stage), count: n(x.count) })),
    propertyComparison: list(d.propertyComparison, (x) => {
      const a = asRaw(x.address);
      const m = asRaw(x.metrics);
      const media = asRaw(x.media);
      return {
        id: idOf(x),
        title: str(x.title, 'Untitled property'),
        type: str(x.type),
        locality: str(a.locality ?? x.locality),
        city: str(a.city ?? x.city),
        photo: str(arr(media.photos)[0] ?? media.coverPhoto),
        views: n(m.views ?? x.views),
        enquiries: n(m.enquiries ?? x.enquiries),
        visits: n(m.visits ?? x.visits),
        compareCount: n(m.compareCount ?? x.compareCount),
      };
    }),
  };
}

/** GET /api/v1/admin/reports/acquisition/analytics?from&to&propertyType */
export async function getAcquisitionAnalytics(query: AnalyticsQuery, signal?: AbortSignal): Promise<AcquisitionAnalytics> {
  const d = asRaw(await apiRequest<Raw>('/v1/admin/reports/acquisition/analytics', { query: { ...query }, signal }));
  const s = asRaw(d.stats);
  return {
    stats: { count: n(s.count), cost: n(s.cost), averageCost: n(s.averageCost), pipelineActive: n(s.pipelineActive), incomingSellRequests: nOrNull(s.incomingSellRequests) },
    stageCounts: list(d.stageCounts, (x) => ({ stage: str(x.stage), count: n(x.count) })),
    acquisitionByType: list(d.acquisitionByType, (x) => ({ type: str(x.type), value: n(x.value), count: n(x.count) })),
  };
}

/** GET /api/v1/admin/reports/revenue/analytics?from&to&propertyType */
export async function getRevenueAnalytics(query: AnalyticsQuery, signal?: AbortSignal): Promise<RevenueAnalytics> {
  const d = asRaw(await apiRequest<Raw>('/v1/admin/reports/revenue/analytics', { query: { ...query }, signal }));
  const s = asRaw(d.stats);
  return {
    stats: { revenue: n(s.revenue), cost: n(s.cost), profit: n(s.profit), margin: n(s.margin) },
    revenueVsCost: list(d.revenueVsCost, (x) => ({ month: str(x.month), revenue: n(x.revenue), cost: n(x.cost) })),
    profitTrend: list(d.profitTrend, (x) => ({ month: str(x.month), profit: n(x.profit) })),
    pendingPayments: list(d.pendingPayments, (x) => ({
      id: idOf(x),
      referenceId: str(x.referenceId, idOf(x)),
      buyer: str(x.buyer),
      property: str(x.property),
      stage: str(x.stage),
      amount: n(x.amount),
      paid: n(x.paid),
      balance: n(x.balance),
      lastActivityAt: str(x.lastActivityAt),
    })),
  };
}

function mapExport(raw: Raw): ReportExport {
  const f = asRaw(raw.filters);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    status: str(raw.status, 'queued'),
    format: str(raw.format ?? f.format, 'xlsx'),
    reportType: str(arr(raw.exportTypes)[0] ?? f.reportType, 'properties'),
    requestedAt: iso(raw.requestedAt ?? raw.createdAt) ?? '',
    expiresAt: iso(raw.expiresAt),
    completedAt: iso(raw.completedAt),
    failureReason: str(raw.failureReason) || null,
    fileName: str(raw.fileName) || null,
    rowCount: raw.rowCount == null ? null : n(raw.rowCount),
  };
}

/** GET /api/v1/admin/reports/exports?limit=20 */
export async function listReportExports(signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/reports/exports', { query: { limit: 20 }, signal });
  return arr(r.data).map((x) => mapExport(asRaw(x)));
}

/** POST /api/v1/admin/reports/export — { filters: { reportType, format, fields, deliveryEmail, estimatedRows } } */
export async function createReportExport(filters: { reportType: ExportReportType; format: ExportFormat; fields?: string[]; deliveryEmail?: string | null; estimatedRows?: number }) {
  return mapExport(asRaw(await apiRequest<Raw>('/v1/admin/reports/export', { method: 'POST', body: { filters } })));
}

/**
 * GET /api/v1/admin/reports/exports/:id/download-url, then the public tokenised
 * GET /api/v1/admin/reports/exports/:id/download URL it returns.
 */
export async function downloadReportExport(id: string): Promise<{ blob: Blob; fileName: string }> {
  const d = asRaw(await apiRequest<Raw>(`/v1/admin/reports/exports/${id}/download-url`));
  const url = str(d.downloadUrl);
  if (!url) throw new Error('Export is not ready to download.');
  const href = /^https?:\/\//i.test(url) ? url : url.startsWith('/api/') ? url : '/api/v1' + (url.startsWith('/') ? url : '/' + url);
  const res = await fetch(href);
  if (!res.ok) throw new Error('Unable to download export file.');
  return { blob: await res.blob(), fileName: str(d.fileName) || 'builtglory-export' };
}

export type CountPath = '/v1/admin/properties' | '/v1/admin/users' | '/v1/admin/sales/deals' | '/v1/admin/acquisitions';

/** Record count for an admin list endpoint (limit=1, reads meta.total). */
export async function countRecords(path: CountPath, signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>(path, { query: { limit: 1, page: 1 }, signal });
  return Number(r.meta?.total) || arr(r.data).length;
}
