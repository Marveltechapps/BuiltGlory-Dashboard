import type { SupportTicket } from '../../../services/support';

/** True once anyone other than the customer has replied on the ticket. */
export const hasAdminReply = (t: SupportTicket) => t.responses.some((r) => r.responderType !== 'customer');
