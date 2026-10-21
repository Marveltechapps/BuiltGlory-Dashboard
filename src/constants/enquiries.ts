/** Status label + tone per enquiry tab, from the reference Enquiries screen. */
export const ENQ_STATUS: Record<string, Record<string, [string, string]>> = {
  buy: { new: ['New', 'blue'], responded: ['Responded', 'green'], visit_scheduled: ['Visit Scheduled', 'purple'], negotiating: ['Negotiating', 'orange'], closed: ['Closed', 'muted'] },
  sell: { draft: ['Draft', 'muted'], new: ['New', 'blue'], under_review: ['Under Review', 'amber'], approved: ['Approved', 'green'], accepted: ['Accepted', 'green'], active: ['Active', 'green'], negotiating: ['Negotiating', 'orange'], changes_requested: ['Changes Requested', 'orange'], rejected: ['Rejected', 'red'], paused: ['Paused', 'muted'], sold: ['Sold', 'purple'] },
  visits: { scheduled: ['Scheduled', 'blue'], confirmed: ['Confirmed', 'green'], completed: ['Completed', 'muted'], cancelled: ['Cancelled', 'red'], missed: ['Missed', 'orange'], rescheduled: ['Rescheduled', 'purple'] },
  callbacks: { pending: ['Pending', 'orange'], called: ['Called', 'blue'], resolved: ['Resolved', 'green'], missed: ['Missed', 'red'], rescheduled: ['Rescheduled', 'purple'], overdue: ['Overdue', 'red'] },
  interior: { new: ['New', 'blue'], contacted: ['Contacted', 'teal'], quote_sent: ['Quote Sent', 'purple'], accepted: ['Accepted', 'green'], negotiating: ['Negotiating', 'orange'], declined: ['Declined', 'red'], completed: ['Completed', 'muted'] },
  chat: { active: ['Active', 'blue'], deal_agreed: ['Deal Agreed', 'green'], lost: ['Lost', 'red'], inactive: ['Inactive', 'muted'] },
};

export const ENQ_TABS: Record<string, string[]> = {
  buy: ['all', 'new', 'responded', 'visit_scheduled', 'negotiating', 'closed'],
  sell: ['all', 'new', 'under_review', 'approved', 'changes_requested', 'rejected', 'paused', 'sold'],
  callbacks: ['all', 'pending', 'called', 'resolved', 'missed', 'rescheduled', 'overdue'],
  interior: ['all', 'new', 'contacted', 'quote_sent', 'accepted', 'negotiating', 'declined', 'completed'],
};

export const INTEREST: Record<string, [string, string]> = { schedule_visit: ['Visit', 'blue'], price_negotiation: ['Negotiate', 'purple'], more_details: ['Details', 'muted'] };
export const INTEREST_LONG: Record<string, string> = { schedule_visit: 'Schedule a Visit', price_negotiation: 'Price Negotiation', more_details: 'More Details' };
export const CONTACT_ICON: Record<string, string> = { phone: 'phone', whatsapp: 'message-circle', email: 'mail' };
export const STYLE_LABEL: Record<string, string> = { modern: 'Modern', contemporary: 'Contemporary', minimalist: 'Minimalist', classic: 'Classic' };
export const BUDGET_LABEL: Record<string, string> = { budget: 'Budget', standard: 'Standard', premium: 'Premium', luxury: 'Luxury' };
export const VISIT_PREF: Record<string, string> = {
  tomorrow_morning: 'Tomorrow morning', tomorrow_afternoon: 'Tomorrow afternoon', this_weekend_morning: 'This weekend morning',
  this_weekend_afternoon: 'This weekend afternoon', custom: 'Custom date & time',
};
export const SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];
export const CALLBACK_CATEGORY: Record<string, string> = {
  property_inquiry: 'Property Inquiry', pricing: 'Pricing', technical_issue: 'Technical', complaint: 'Complaint', general: 'General', stage_payment: 'Stage Payment', interior: 'Interior',
};
export const BEST_TIME: Record<string, string> = { morning: 'Morning (9 AM – 12 PM)', afternoon: 'Afternoon (12 – 4 PM)', evening: 'Evening (4 – 8 PM)' };
