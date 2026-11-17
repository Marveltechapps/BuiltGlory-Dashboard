import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { DETAIL_ROUTES, findTab, OVERVIEW } from '../../constants/nav';
import { firstAllowedPath, isPathAllowed } from '../../constants/permissions';
import { clearIntentionalSignOut, isIntentionalSignOut } from '../../lib/signOutIntent';
import { useAuthStore } from '../../store/authStore';
import { ComposeDialog } from '../../components/ui/ComposeDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toaster } from '../../components/ui/Toaster';

const SAFE_REDIRECT = /^\/admin(?:\/|$|\?)/;

/** Root element: global dialogs + toasts that every route shares. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ConfirmDialog />
      <ComposeDialog />
      <Toaster />
    </>
  );
}

const knownAdminRoute = (path: string) => path === OVERVIEW.path || !!findTab(path) || DETAIL_ROUTES.some(([re]) => re.test(path));

/** Admin routes: requires a session, a known route, and a permission that covers the path. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const expired = useAuthStore((s) => s.expired);
  const { pathname, search } = useLocation();
  if (!session) {
    if (isIntentionalSignOut()) return <Navigate to="/login" replace />;
    const redirect = encodeURIComponent(pathname + search);
    return <Navigate to={`/login?${expired ? 'reason=timeout&' : ''}redirect=${redirect}`} replace />;
  }
  if (!knownAdminRoute(pathname)) return <Navigate to={OVERVIEW.path} replace />;
  if (!isPathAllowed(session.admin, pathname)) return <Navigate to={firstAllowedPath(session.admin)} replace />;
  return <>{children}</>;
}

/** Login route: signed-in admins go straight to the redirect target or Overview. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const [params] = useSearchParams();
  useEffect(() => {
    if (!session) clearIntentionalSignOut();
  }, [session]);
  if (session) {
    const r = params.get('redirect');
    return <Navigate to={r && SAFE_REDIRECT.test(r) ? r : OVERVIEW.path} replace />;
  }
  return <>{children}</>;
}

export function EntryRedirect() {
  const session = useAuthStore((s) => s.session);
  return <Navigate to={session ? OVERVIEW.path : '/login'} replace />;
}
