import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, bool, idOf, iso, num, str, type Raw } from '../../lib/raw';
import type { AdminUser, FemaStatus, KycStatus, UserRole, UserType, UserUpdateBody } from '../../types/users';

const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v ?? '').toLowerCase() as T) ? (String(v).toLowerCase() as T) : d);
const entityName = (v: unknown) => (v && typeof v === 'object' ? str(asRaw(v).name || asRaw(v).email || asRaw(v).referenceId) || null : null);

export function mapUser(raw: Raw): AdminUser {
  const fema = asRaw(raw.femaCompliance);
  const registered = iso(raw.registeredAt ?? raw.createdAt) ?? new Date().toISOString();
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    name: str(raw.name, 'Unnamed user'),
    phone: str(raw.phone ?? raw.mobileNumber ?? raw.phoneNormalized),
    email: str(raw.email) || null,
    userType: oneOf<UserType>(raw.userType, ['resident', 'nri', 'pio'], 'resident'),
    role: oneOf<UserRole>(raw.role, ['buyer', 'seller', 'both'], 'buyer'),
    profilePhoto: str(raw.profilePhoto) || null,
    kycStatus: oneOf<KycStatus>(raw.kycStatus, ['not_submitted', 'pending', 'verified', 'rejected'], 'not_submitted'),
    kycDocuments: arr(raw.kycDocuments).map((d) => {
      const x = asRaw(d);
      return {
        id: idOf(x),
        name: str(x.name, str(x.type, 'KYC Document')),
        type: str(x.type, 'document'),
        status: str(x.status, 'missing'),
        uploadedAt: iso(x.uploadedAt),
        verifiedAt: iso(x.verifiedAt),
        rejectionReason: str(x.rejectionReason) || null,
        fileUrl: str(x.fileUrl) || null,
      };
    }),
    totalEnquiries: num(raw.totalEnquiries) ?? 0,
    totalVisits: num(raw.totalVisits) ?? 0,
    totalDeals: num(raw.totalDeals) ?? 0,
    totalListings: num(raw.totalListings) ?? 0,
    city: str(raw.city),
    state: str(raw.state),
    country: str(raw.country, 'India'),
    registeredAt: registered,
    lastLoginAt: iso(raw.lastLoginAt),
    isActive: raw.isActive !== false && !bool(raw.isBlocked),
    isBlocked: bool(raw.isBlocked),
    blockedReason: str(raw.blockedReason) || null,
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedToName: entityName(raw.assignedTo),
    fema:
      raw.femaCompliance && Object.keys(fema).length
        ? {
            status: oneOf<FemaStatus>(fema.status, ['not_checked', 'compliant', 'non_compliant', 'under_review'], 'not_checked'),
            checkedBy: entityName(fema.checkedBy) ?? (idOf(fema.checkedBy) || null),
            checkedAt: iso(fema.checkedAt),
            notes: str(fema.notes) || null,
          }
        : null,
  };
}

/** GET /api/v1/admin/users (all pages, newest first) */
export const listUsers = (signal?: AbortSignal) => fetchAllPages('/v1/admin/users', mapUser, { sort: 'newest' }, signal);

/** GET /api/v1/admin/users/:userId */
export async function getUser(id: string, signal?: AbortSignal) {
  return mapUser(asRaw(await apiRequest<Raw>(`/v1/admin/users/${id}`, { signal })));
}

/** GET /api/v1/admin/users/:userId/export — returns the user's data export payload. */
export const exportUser = (id: string) => apiRequest<unknown>(`/v1/admin/users/${id}/export`);

const patch = async (id: string, suffix: string, body: UserUpdateBody) => mapUser(asRaw(await apiRequest<Raw>(`/v1/admin/users/${id}${suffix}`, { method: 'PATCH', body })));

/** PATCH /api/v1/admin/users/:userId */
export const updateUser = (id: string, body: UserUpdateBody) => patch(id, '', body);
/** PATCH /api/v1/admin/users/:userId/block — { isBlocked, blockedReason } */
export const setUserBlocked = (id: string, isBlocked: boolean, blockedReason?: string | null) => patch(id, '/block', { isBlocked, blockedReason: blockedReason ?? null });
/** PATCH /api/v1/admin/users/:userId/assign — { assignedTo } */
export const assignUser = (id: string, assignedTo: string) => patch(id, '/assign', { assignedTo });
/** PATCH /api/v1/admin/users/:userId/fema — { status, notes } */
export const updateUserFema = (id: string, status: FemaStatus, notes?: string | null) => patch(id, '/fema', { status, ...(notes !== undefined ? { notes } : {}) });
