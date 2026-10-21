/** `GET /api/v1/admin/reports/sales/analytics` */
export interface SalesAnalytics {
  stats: { count: number; revenue: number; averageDealValue: number; conversion: number; pipelineCount: number | null; pipelineValue: number | null };
  monthlyClosedDeals: Array<{ month: string; deals: number; revenue: number }>;
  monthlyDealActivity: Array<{ month: string; deals: number }>;
  revenueByType: Array<{ type: string; revenue: number; deals: number }>;
  pipelineByStage: Array<{ stage: string; count: number }>;
  propertyComparison: Array<{ id: string; title: string; type: string; locality: string; city: string; photo: string; views: number; enquiries: number; visits: number; compareCount: number }>;
}

/** `GET /api/v1/admin/reports/acquisition/analytics` */
export interface AcquisitionAnalytics {
  stats: { count: number; cost: number; averageCost: number; pipelineActive: number; incomingSellRequests: number | null };
  stageCounts: Array<{ stage: string; count: number }>;
  acquisitionByType: Array<{ type: string; value: number; count: number }>;
}

/** `GET /api/v1/admin/reports/revenue/analytics` */
export interface RevenueAnalytics {
  stats: { revenue: number; cost: number; profit: number; margin: number };
  revenueVsCost: Array<{ month: string; revenue: number; cost: number }>;
  profitTrend: Array<{ month: string; profit: number }>;
  pendingPayments: Array<{ id: string; referenceId: string; buyer: string; property: string; stage: string; amount: number; paid: number; balance: number; lastActivityAt: string }>;
}

/** `GET /api/v1/admin/reports/exports[/:id]` */
export interface ReportExport {
  id: string;
  referenceId: string;
  status: string;
  format: string;
  reportType: string;
  requestedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  fileName: string | null;
  rowCount: number | null;
}

export type ExportReportType = 'properties' | 'users' | 'sales' | 'sales_deals' | 'acquisitions';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
