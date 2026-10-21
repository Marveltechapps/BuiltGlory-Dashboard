export type SalesStage =
  | 'active_leads' | 'site_visits' | 'negotiation' | 'token_payment' | 'full_payment' | 'stage_payment'
  | 'interior_design' | 'documentation' | 'closed' | 'lost' | 're_engagement';

export interface Milestone {
  id: string;
  name: string;
  amount: number;
  dueDate: string | null;
  status: string;
  proofUrl: string;
  proofSubmittedAt: string | null;
  paidAt: string | null;
}

/** `GET /api/v1/admin/sales/deals[/:dealId]` (normalised) */
export interface SalesDeal {
  id: string;
  referenceId: string;
  stage: SalesStage | string;
  priority: 'normal' | 'high' | 'urgent' | string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerType: string;
  propertyId: string;
  propertyTitle: string;
  propertyType: string;
  propertyLocation: string;
  listedPrice: number;
  offeredPrice: number | null;
  agreedPrice: number | null;
  tokenAmount: number | null;
  tokenPaid: boolean;
  tokenPayment: Record<string, unknown>;
  paymentType: 'full' | 'stage' | null;
  totalPaid: number;
  fullPayment: Record<string, unknown>;
  stagePayment: Record<string, unknown>;
  milestones: Milestone[];
  interiorDesign: Record<string, unknown>;
  documentation: Record<string, unknown>;
  assignedTo: string | null;
  assignedName: string | null;
  sourceEnquiryId: string | null;
  lostReason: string;
  lostAtStage: string;
  closedAt: string | null;
  reengagement: { followUpAt: string | null; lastContactAt: string | null; attempts: number };
  stageEnteredAt: string;
  daysInStage: number;
  lastActivityAt: string;
  createdAt: string;
  photos: string[];
  stageHistory: Array<{ from: string; to: string; changedAt: string; notes: string }>;
}

export interface DealRecommendation {
  id: string;
  title: string;
  price: number;
  type: string;
  location: string;
  coverPhoto: string;
  score: number;
  reason: string;
}

/** `GET /api/v1/admin/payments` (normalised) */
export interface AdminPayment {
  id: string;
  referenceId: string;
  dealId: string;
  propertyId: string;
  type: string;
  amount: number;
  status: string;
  method: string;
  transactionReference: string;
  proofUrl: string;
  notes: string;
  verifiedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}
