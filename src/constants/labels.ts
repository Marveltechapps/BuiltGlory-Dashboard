export const TYPE_LABELS: Record<string, string> = {
  plot: 'Plot', apartment: 'Apartment', residential: 'Residential', commercial: 'Commercial', organic_home: 'Organic Home', '3d_printing': '3D Printing',
  fractional: 'Fractional', ceo_mansion: 'CEO Mansion', holiday_home: 'Holiday Home', land: 'Land', farmhouse: 'Farmhouse', nri: 'NRI', interior: 'Interior', villa: 'Villa',
};

export const ACQ_STAGES: Array<[string, string]> = [
  ['pending_review', 'Pending Review'], ['site_inspection', 'Site Inspection'], ['valuation', 'Valuation'], ['negotiation', 'Negotiation'],
  ['token_to_seller', 'Token to Seller'], ['documentation', 'Documentation'], ['seller_payout', 'Seller Payout'], ['acquired', 'Acquired'],
  ['rejected', 'Rejected'], ['on_hold', 'On Hold'],
];

export const SALES_STAGES: Array<[string, string]> = [
  ['active_leads', 'Active Leads'], ['site_visits', 'Site Visits'], ['negotiation', 'Negotiation'], ['token_payment', 'Token Payment'],
  ['full_payment', 'Full Payment'], ['stage_payment', 'Stage Payment'], ['interior_design', 'Interior Design'], ['documentation', 'Documentation'],
  ['closed', 'Closed'], ['lost', 'Lost'], ['re_engagement', 'Re-engagement'],
];

/** Badge tone palette: [background, foreground]. */
export const TONE: Record<string, [string, string]> = {
  blue: ['#dbeafe', '#1d4ed8'], green: ['#dcfce7', '#15803d'], purple: ['#f3e8ff', '#7e22ce'], orange: ['#ffedd5', '#c2410c'], red: ['#fee2e2', '#b91c1c'],
  muted: ['#f1f5f9', '#64748b'], amber: ['#fef3c7', '#92400e'], teal: ['#ccfbf1', '#0f766e'], indigo: ['#e0e7ff', '#4338ca'], pink: ['#fce7f3', '#be185d'],
  emerald: ['#d1fae5', '#047857'], yellow: ['#fef9c3', '#a16207'], slate: ['#f1f5f9', '#475569'],
};

/** Status → tone, shared by tables, detail headers and timelines. */
export const STATUS_TONES: Record<string, string> = {
  new: 'blue', responded: 'green', visit_scheduled: 'purple', negotiating: 'orange', closed: 'muted', under_review: 'amber', approved: 'green',
  changes_requested: 'orange', rejected: 'red', paused: 'slate', sold: 'purple', draft: 'amber', scheduled: 'blue', confirmed: 'green', completed: 'muted',
  cancelled: 'red', missed: 'orange', rescheduled: 'purple', pending: 'orange', called: 'blue', resolved: 'green', overdue: 'red', contacted: 'teal',
  quote_sent: 'purple', accepted: 'green', declined: 'red', open: 'blue', in_progress: 'amber', available: 'green', under_construction: 'orange',
  reserved: 'blue', paid: 'green', proof_pending: 'amber', sent: 'purple', verified: 'green', missing: 'red', requested: 'amber', active: 'green',
  blocked: 'red', urgent: 'red', high: 'orange', medium: 'amber', low: 'muted', normal: 'muted', expired: 'muted', queued: 'amber', delivered: 'green',
  failed: 'red', dead_letter: 'red', published: 'green', archived: 'muted', reviewed: 'green', suspended: 'red', invited: 'amber',
  processing: 'amber', ready: 'green',
};

export const PRIORITY_DOT: Record<string, string> = { urgent: '#ef4444', high: '#f97316', normal: '#94a3b8', medium: '#f59e0b', low: '#94a3b8' };

export const SALES_TEAM_FALLBACK_ROLE = 'Sales Executive';
