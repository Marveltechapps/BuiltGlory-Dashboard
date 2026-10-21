export type UserType = 'resident' | 'nri' | 'pio';
export type UserRole = 'buyer' | 'seller' | 'both';
export type FemaStatus = 'not_checked' | 'compliant' | 'non_compliant' | 'under_review';
export type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface KycDocument {
  id: string;
  name: string;
  type: string;
  status: 'missing' | 'uploaded' | 'verified' | 'rejected' | 'expired' | string;
  uploadedAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  fileUrl: string | null;
}

/** `GET /api/v1/admin/users[/:userId]` (normalised) */
export interface AdminUser {
  id: string;
  referenceId: string;
  name: string;
  phone: string;
  email: string | null;
  userType: UserType;
  role: UserRole;
  profilePhoto: string | null;
  kycStatus: KycStatus;
  kycDocuments: KycDocument[];
  totalEnquiries: number;
  totalVisits: number;
  totalDeals: number;
  totalListings: number;
  city: string;
  state: string;
  country: string;
  registeredAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  fema: { status: FemaStatus; checkedBy: string | null; checkedAt: string | null; notes: string | null } | null;
}

/** PATCH /admin/users/:userId (and /block, /assign, /kyc, /fema) — fields from updateValidator. */
export interface UserUpdateBody {
  name?: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  userType?: UserType;
  role?: UserRole;
  isBlocked?: boolean;
  blockedReason?: string | null;
  assignedTo?: string | null;
  status?: string;
  notes?: string | null;
}
