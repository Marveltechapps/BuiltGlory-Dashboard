export interface OverviewScheduleItem {
  id: string;
  referenceId?: string;
  buyerName: string;
  buyerPhone?: string;
  propertyTitle: string;
  visitDate: string;
  visitTime: string;
  visitType: 'physical' | 'virtual' | string;
  status: string;
  viewPath: string;
}

export interface OverviewSlaItem {
  id: string;
  name: string;
  property: string;
  phone?: string;
  email?: string;
  viewPath: string;
  sourceTime: string;
  limitHours: number;
  elapsedHours: number;
  remainingHours: number;
  progressPercent: number;
  status: 'ok' | 'warning' | 'breached';
}

/** `GET /api/v1/admin/overview` → data */
export interface AdminOverview {
  kpis?: {
    activeProperties?: number;
    featuredProperties?: number;
    upcomingProperties?: number;
    newEnquiries?: number;
    tokenPaidDeals?: number;
    closedDeals?: number;
    revenue?: number;
    totalProperties?: number;
    totalEnquiries?: number;
    stagePaymentDeals?: number;
    overdueCallbacks?: number;
    openSupportTickets?: number;
    pendingKycUsers?: number;
    pendingSellRequests?: number;
  };
  schedule?: OverviewScheduleItem[];
  recentActivities?: Array<{ id: string; description: string; time: string; route: string; resourceType?: string; action?: string }>;
  pipelineCounts?: {
    acquisitions?: Array<{ value?: string; count?: number }>;
    sales?: Array<{ value?: string; count?: number }>;
  };
  chartSeries?: {
    enquiriesLast7Days?: Array<{ date?: string; day: string; count: number }>;
    propertiesByType?: Array<{ value?: string; count: number }>;
  };
  recentEnquiries?: Array<{ id: string; referenceId?: string; buyer: string; property: string; type: string; date: string; status: string; viewPath: string }>;
  pendingApprovals?: Array<{ id: string; referenceId?: string; seller: string; title: string; type: string; submitted: string; status?: string; viewPath: string }>;
  slaLimits?: { enquiry?: number; stagePayment?: number; interior?: number };
  slaQueues?: {
    enquiries?: OverviewSlaItem[];
    stagePayments?: OverviewSlaItem[];
    interiorLeads?: OverviewSlaItem[];
  };
  navBadges?: Record<string, number>;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  route: string;
  icon: string;
}

export interface SearchResult {
  type: 'property' | 'user' | 'enquiry' | 'acquisition' | 'deal';
  id: string;
  title: string;
  subtitle: string;
  route: string;
  emoji: string;
}
