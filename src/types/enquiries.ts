export type EnquiryStatus = 'new' | 'responded' | 'visit_scheduled' | 'negotiating' | 'closed';

/** `GET /api/v1/admin/buy-enquiries[/:id]` (normalised) */
export interface BuyEnquiry {
  id: string;
  referenceId: string;
  buyerId: string;
  buyerName: string;
  phone: string;
  email: string | null;
  userType: string;
  propertyId: string;
  propertyTitle: string;
  propertyType: string;
  propertyPrice: number;
  propertyLocation: string;
  enquiryTypes: string[];
  interest: 'schedule_visit' | 'price_negotiation' | 'more_details' | string;
  preferredContact: 'phone' | 'whatsapp' | 'email' | string;
  preferredVisitTime: string | null;
  preferredVisitDate: string | null;
  preferredVisitTimeSlot: string | null;
  message: string;
  status: EnquiryStatus | string;
  assignedTo: string | null;
  assignedName: string | null;
  duplicateOf: string | null;
  dealId: string | null;
  source: string;
  notes: string;
  createdAt: string;
}

export interface SellDocument {
  name: string;
  status: string;
  fileUrl: string;
}

/** `GET /api/v1/admin/sell-requests[/:id]` (normalised) */
export interface SellRequest {
  id: string;
  referenceId: string;
  sellerId: string;
  sellerName: string;
  phone: string;
  email: string | null;
  kycStatus: string;
  userType: string;
  title: string;
  type: string;
  askingPrice: number;
  negotiable: boolean;
  street: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  ownershipType: string;
  possessionStatus: string;
  loanOnProperty: boolean;
  description: string;
  amenities: string[];
  specifications: Record<string, string>;
  photos: string[];
  documents: SellDocument[];
  completeness: number;
  status: string;
  assignedTo: string | null;
  assignedName: string | null;
  rejectionReason: string;
  pauseReason: string;
  changeRequests: string[];
  acquisitionId: string | null;
  duplicateOf: string | null;
  metrics: { views: number; enquiryCount: number; visitCount: number; saveCount: number };
  sale: { salePrice: number | null; saleDate: string | null; buyerName: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface VisitFeedback {
  buyerInterest: string;
  notes: string;
  nextAction: string;
  completedAt: string | null;
}

/** `GET /api/v1/admin/visits[/:id]` (normalised) */
export interface Visit {
  id: string;
  referenceId: string;
  buyerId: string;
  buyerName: string;
  phone: string;
  email: string | null;
  userType: string;
  propertyId: string;
  propertyTitle: string;
  propertyType: string;
  propertyPrice: number | null;
  propertyAddress: string;
  propertyImage: string;
  visitDate: string;
  visitTime: string;
  visitType: 'physical' | 'virtual' | string;
  status: string;
  meetingLink: string | null;
  virtualPlatform: string | null;
  recordingUrl: string | null;
  callDuration: number | null;
  callNotes: string;
  assignedTo: string | null;
  assignedName: string | null;
  feedback: VisitFeedback | null;
  callLogs: Array<{ id: string; outcome: string; notes: string; duration: number; at: string }>;
  notes: Array<{ id: string; text: string; at: string }>;
  nriChecklist: Record<string, boolean>;
  nriAssistanceNotes: string;
  documentsShared: string[];
  followUpAction: string;
  followUpDate: string | null;
  rescheduleHistory: Array<{ previousDate: string; previousTime: string; newDate: string; newTime: string; reason: string; at: string }>;
  cancelReason: string;
  reminderSent: boolean;
  createdAt: string;
}

/** `GET /api/v1/admin/callbacks[/:id]` (normalised) */
export interface Callback {
  id: string;
  referenceId: string;
  callerId: string;
  callerName: string;
  phone: string;
  email: string | null;
  userType: string;
  source: string;
  sourceScreen: string;
  category: string;
  propertyId: string | null;
  propertyTitle: string;
  reason: string;
  preferredTime: string | null;
  bestTimePreference: string;
  status: string;
  attemptCount: number;
  attempts: Array<{ id: string; outcome: string; notes: string; at: string }>;
  resolutionNotes: string;
  assignedTo: string | null;
  assignedName: string | null;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/v1/admin/interior/leads[/:id]` (normalised) */
export interface InteriorLead {
  id: string;
  referenceId: string;
  buyerId: string;
  buyerName: string;
  phone: string;
  email: string | null;
  userType: string;
  propertyId: string;
  propertyTitle: string;
  propertyLocation: string;
  rooms: string[];
  style: string;
  budget: string;
  specialNotes: string;
  status: string;
  assignedDesigner: string | null;
  designerName: string | null;
  slaDeadline: string | null;
  quote: { amount: number | null; packageName: string; timeline: string; inclusions: string[]; validUntil: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'buyer' | 'admin' | string;
  type: 'text' | 'offer' | 'deal_agreed' | string;
  text: string;
  offerAmount: number | null;
  offerStatus: string | null;
  at: string;
}

/** `GET /api/v1/admin/negotiations/chats[/:threadId]` (normalised) */
export interface ChatThread {
  id: string;
  buyerId: string;
  buyerName: string;
  phone: string;
  email: string | null;
  propertyId: string;
  propertyTitle: string;
  listedPrice: number;
  status: 'active' | 'deal_agreed' | 'lost' | 'inactive' | string;
  agreedPrice: number | null;
  deadline: string | null;
  dealId: string | null;
  lastMessageAt: string;
  messages: ChatMessage[];
}
