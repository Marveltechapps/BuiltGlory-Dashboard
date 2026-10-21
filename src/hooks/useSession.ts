import { useAuthStore } from '../store/authStore';
import { hasAny, type AdminPermission } from '../constants/permissions';

/** Signed-in admin plus permission helpers (role defaults or explicit `admin.permissions`). */
export function useSession() {
  const session = useAuthStore((s) => s.session);
  const admin = session?.admin ?? null;
  return {
    session,
    admin,
    name: admin?.name || admin?.email || 'Admin',
    can: (p: AdminPermission) => hasAny(admin, [p]),
    canAny: (list: AdminPermission[]) => hasAny(admin, list),
  };
}
