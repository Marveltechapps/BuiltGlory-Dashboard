export interface NavTab {
  id: string;
  label: string;
  path: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  tabs: NavTab[];
  defaultPath: string;
}

export const OVERVIEW = { id: 'overview', label: 'Overview', path: '/admin/overview', icon: 'layout-dashboard' } as const;

const section = (id: string, label: string, icon: string, tabs: Array<[string, string, string]>): NavSection => ({
  id,
  label,
  icon,
  tabs: tabs.map(([tid, tlabel, path]) => ({ id: tid, label: tlabel, path })),
  defaultPath: tabs[0]![2],
});

export const navigation: NavSection[] = [
  section('enquiries', 'Enquiries', 'message-square', [
    ['buy', 'Buy Enquiries', '/admin/enquiries/buy'], ['sell', 'Sell Requests', '/admin/enquiries/sell'], ['visits', 'Visits', '/admin/enquiries/visits'],
    ['callbacks', 'Callbacks', '/admin/enquiries/callbacks'], ['interior', 'Interior Leads', '/admin/enquiries/interior'], ['chat', 'Chat', '/admin/enquiries/chat'],
  ]),
  section('acquisition', 'Acquisition Pipeline', 'building-2', [
    ['all', 'All', '/admin/acquisition/all'], ['pending', 'Pending Review', '/admin/acquisition/pending'], ['inspection', 'Site Inspection', '/admin/acquisition/inspection'],
    ['valuation', 'Valuation', '/admin/acquisition/valuation'], ['negotiation', 'Negotiation', '/admin/acquisition/negotiation'], ['token', 'Token to Seller', '/admin/acquisition/token'],
    ['documentation', 'Documentation', '/admin/acquisition/documentation'], ['payout', 'Seller Payout', '/admin/acquisition/payout'], ['acquired', 'Acquired', '/admin/acquisition/acquired'],
    ['rejected', 'Rejected', '/admin/acquisition/rejected'], ['onhold', 'On Hold', '/admin/acquisition/on-hold'],
  ]),
  section('sales', 'Sales Pipeline', 'trending-up', [
    ['all', 'All', '/admin/sales/all'], ['leads', 'Active Leads', '/admin/sales/leads'], ['visits', 'Site Visits', '/admin/sales/visits'], ['negotiation', 'Negotiation', '/admin/sales/negotiation'],
    ['token', 'Token Payment', '/admin/sales/token'], ['fullpayment', 'Full Payment', '/admin/sales/fullpayment'], ['stagepayment', 'Stage Payment', '/admin/sales/stagepayment'],
    ['interior', 'Interior Design', '/admin/sales/interior'], ['documentation', 'Documentation', '/admin/sales/documentation'], ['closed', 'Closed', '/admin/sales/closed'],
    ['lost', 'Lost', '/admin/sales/lost'], ['reengagement', 'Re-engagement', '/admin/sales/reengagement'],
  ]),
  section('properties', 'Properties', 'building', [
    ['all', 'All Properties', '/admin/properties/all'], ['add', 'Add Property', '/admin/properties/add'], ['upload', 'Bulk Upload', '/admin/properties/upload'],
    ['featured', 'Featured', '/admin/properties/featured'], ['upcoming', 'Upcoming', '/admin/properties/upcoming'], ['templates', 'Templates', '/admin/properties/templates'],
  ]),
  section('users', 'Users', 'users', [['all', 'All Users', '/admin/users/all'], ['buyers', 'Buyers', '/admin/users/buyers'], ['sellers', 'Sellers', '/admin/users/sellers']]),
  section('reports', 'Reports', 'bar-chart-2', [
    ['sales', 'Sales Report', '/admin/reports/sales'], ['acquisition', 'Acquisition Report', '/admin/reports/acquisition'], ['revenue', 'Revenue', '/admin/reports/revenue'], ['export', 'Export', '/admin/reports/export'],
  ]),
  section('tools', 'Tools', 'wrench', [
    ['content', 'App Content', '/admin/tools/content'], ['mastersheet', 'Master Sheet', '/admin/tools/mastersheet'], ['locations', 'Locations', '/admin/tools/locations'],
    ['pricing', 'Pricing', '/admin/tools/pricing'], ['templates', 'Message Templates', '/admin/tools/templates'], ['bulkmessage', 'Bulk Message', '/admin/tools/bulkmessage'], ['push', 'Push Notifications', '/admin/tools/push'],
  ]),
  section('admin', 'Admin', 'shield', [
    ['support', 'Support Tickets', '/admin/settings/support'], ['feedback', 'Feedback', '/admin/settings/feedback'], ['access', 'Access Control', '/admin/settings/access'],
    ['general', 'Settings', '/admin/settings/general'], ['legal', 'Legal Content', '/admin/settings/legal'], ['audit', 'Audit Trail', '/admin/settings/audit'],
  ]),
];

export function findTab(path: string): (NavTab & { section: NavSection }) | null {
  for (const s of navigation) {
    const t = s.tabs.find((x) => x.path === path);
    if (t) return { ...t, section: s };
  }
  return null;
}

export const findSection = (path: string) => navigation.find((s) => s.tabs.some((t) => t.path === path));

/** Detail routes: path pattern → page title shown in the header ("Admin" fallback in the reference). */
export const DETAIL_ROUTES: Array<[RegExp, string, string]> = [
  [/^\/admin\/enquiries\/buy\/[^/]+$/, 'Buy Enquiry detail', 'enquiries'],
  [/^\/admin\/enquiries\/sell\/[^/]+$/, 'Sell Request detail', 'enquiries'],
  [/^\/admin\/enquiries\/interior\/[^/]+$/, 'Interior Lead detail', 'enquiries'],
  [/^\/admin\/visits\/[^/]+$/, 'Visit detail', 'enquiries'],
  [/^\/admin\/callbacks\/[^/]+$/, 'Callback detail', 'enquiries'],
  [/^\/admin\/acquisition\/[^/]+$/, 'Acquisition detail', 'acquisition'],
  [/^\/admin\/sales\/[^/]+$/, 'Sales Deal detail', 'sales'],
  [/^\/admin\/properties\/[^/]+$/, 'Property detail', 'properties'],
  [/^\/admin\/users\/[^/]+$/, 'User detail', 'users'],
  [/^\/admin\/settings\/support\/[^/]+$/, 'Support Ticket detail', 'admin'],
];
