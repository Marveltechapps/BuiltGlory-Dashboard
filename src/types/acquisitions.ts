export type AcquisitionStage =
  | 'pending_review' | 'site_inspection' | 'valuation' | 'negotiation' | 'token_to_seller'
  | 'documentation' | 'seller_payout' | 'acquired' | 'rejected' | 'on_hold';

/** `GET /api/v1/admin/acquisitions[/:acquisitionId]` (normalised) */
export interface Acquisition {
  id: string;
  referenceId: string;
  stage: AcquisitionStage | string;
  priority: 'normal' | 'high' | 'urgent' | string;
  createdFrom: 'sell_request' | 'manual';
  sellRequestId: string | null;
  sellerId: string;
  sellerName: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerKycStatus: string;
  sellerType: string;
  title: string;
  type: string;
  location: string;
  city: string;
  askingPrice: number;
  builtgloryOffer: number | null;
  agreedPrice: number | null;
  finalPurchasePrice: number | null;
  assignedTo: string | null;
  assignedName: string | null;
  stageEnteredAt: string;
  daysInStage: number;
  lastActivityAt: string;
  createdAt: string;
  photos: string[];
  rejectionReason: string;
  onHoldReason: string;
  notes: string;
  propertyDetails: Record<string, unknown>;
  valuation: Record<string, unknown>;
  negotiation: Record<string, unknown>;
  token: Record<string, unknown>;
  documentation: Record<string, unknown>;
  payout: Record<string, unknown>;
  propertyId: string | null;
  stageHistory: Array<{ from: string; to: string; changedAt: string; notes: string }>;
}
