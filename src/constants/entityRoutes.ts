/** Detail route for a communication-log / audit record's entity. */
export const ENTITY_ROUTE: Record<string, string> = {
  buy_enquiry: '/admin/enquiries/buy/',
  sell_request: '/admin/enquiries/sell/',
  acquisition: '/admin/acquisition/',
  sales_deal: '/admin/sales/',
  visit: '/admin/visits/',
  callback: '/admin/callbacks/',
  interior_lead: '/admin/enquiries/interior/',
  support_ticket: '/admin/settings/support/',
  user: '/admin/users/',
  property: '/admin/properties/',
};

export const ENTITY_LABEL: Record<string, string> = {
  buy_enquiry: 'Buy enquiry', sell_request: 'Sell request', acquisition: 'Acquisition', sales_deal: 'Sales deal', visit: 'Visit', callback: 'Callback',
  interior_lead: 'Interior lead', support_ticket: 'Support ticket', user: 'User', property: 'Property',
};
