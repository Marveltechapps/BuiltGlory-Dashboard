/** FEMA status → [icon, colour, tooltip] for the users table. */
export const FEMA_ICON: Record<string, [string, string, string]> = {
  compliant: ['check-circle', '#16a34a', 'FEMA compliance status: Compliant'],
  non_compliant: ['x-circle', '#dc2626', 'FEMA compliance status: Non-Compliant'],
  under_review: ['clock', '#d97706', 'FEMA compliance status: Under Review'],
  not_checked: ['help-circle', '#94a3b8', 'FEMA compliance status: Not Checked'],
};

export const FEMA_LABEL: Record<string, string> = {
  compliant: '✅ FEMA Compliant',
  non_compliant: '❌ Non-Compliant',
  under_review: '⏳ Under Review',
  not_checked: 'Not Checked',
};

export const USER_TAB: Record<string, 'all' | 'buyers' | 'sellers'> = {
  '/admin/users/all': 'all',
  '/admin/users/buyers': 'buyers',
  '/admin/users/sellers': 'sellers',
};
