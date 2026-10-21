/** Route segment → stage value for the pipeline tabs. */
export const ACQ_TAB: Record<string, string | null> = {
  all: null, pending: 'pending_review', inspection: 'site_inspection', valuation: 'valuation', negotiation: 'negotiation', token: 'token_to_seller',
  documentation: 'documentation', payout: 'seller_payout', acquired: 'acquired', rejected: 'rejected', 'on-hold': 'on_hold',
};

export const SALES_TAB: Record<string, string | null> = {
  all: null, leads: 'active_leads', visits: 'site_visits', negotiation: 'negotiation', token: 'token_payment', fullpayment: 'full_payment',
  stagepayment: 'stage_payment', interior: 'interior_design', documentation: 'documentation', closed: 'closed', lost: 'lost', reengagement: 're_engagement',
};

export const STAGE_DOT: Record<'acquisition' | 'sales', Record<string, string>> = {
  acquisition: { pending_review: '#3b82f6', site_inspection: '#a855f7', valuation: '#f97316', negotiation: '#eab308', token_to_seller: '#22c55e', documentation: '#14b8a6', seller_payout: '#6366f1', acquired: '#15803d', rejected: '#ef4444', on_hold: '#64748b' },
  sales: { active_leads: '#3b82f6', site_visits: '#a855f7', negotiation: '#eab308', token_payment: '#10b981', full_payment: '#22c55e', stage_payment: '#14b8a6', interior_design: '#ec4899', documentation: '#6366f1', closed: '#6b7280', lost: '#ef4444', re_engagement: '#f97316' },
};

export const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
