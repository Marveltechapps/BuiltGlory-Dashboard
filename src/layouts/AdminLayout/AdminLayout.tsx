import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { findSection, findTab, OVERVIEW } from '../../constants/nav';
import { allowedSections } from '../../constants/permissions';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { useOnlineStatus } from '../../hooks/useDomUtils';
import { useSession } from '../../hooks/useSession';
import { useViewport } from '../../hooks/useViewport';
import { adminIdleExpired, touchAdminActivity } from '../../lib/apiClient';
import { markIntentionalSignOut } from '../../lib/signOutIntent';
import { chatSocket } from '../../lib/realtime';
import { getOverview } from '../../services/overview';
import { logoutAdmin } from '../../services/auth';
import { useCacheLoginStats } from '../../modules/auth/hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { GlobalSearch, MobileSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { Sidebar } from './Sidebar';
import styles from './AdminLayout.module.css';

const COLLAPSE_KEY = 'builtglory-sidebar-collapsed';
type Mode = 'expanded' | 'collapsed' | 'hidden';

const storedCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
};

export function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { vw, isMd } = useViewport();
  const { admin, canAny } = useSession();
  const { offline, backOnline } = useOnlineStatus();
  const bp = vw < 768 ? 'sm' : vw < 1024 ? 'md' : 'lg';
  const [mode, setMode] = useState<Mode>(() => (bp === 'sm' ? 'hidden' : bp === 'md' ? 'collapsed' : storedCollapsed() ? 'collapsed' : 'expanded'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mSearchOpen, setMSearchOpen] = useState(false);

  useEffect(() => {
    setMode(bp === 'sm' ? 'hidden' : bp === 'md' ? 'collapsed' : storedCollapsed() ? 'collapsed' : 'expanded');
    setMobileOpen(false);
  }, [bp]);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setMSearchOpen(false);
  }, [pathname]);

  // When the section's tab strip overflows (tablet/phone), bring the active tab into view.
  // Only the strip scrolls sideways; the page's vertical position is left alone.
  const tabsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const nr = nav.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    if (ar.left < nr.left || ar.right > nr.right) nav.scrollLeft += ar.left - nr.left - (nr.width - ar.width) / 2;
  }, [pathname, vw]);

  const token = useAuthStore((s) => s.session?.accessToken);
  const overviewAllowed = canAny(['sales.read', 'acquisitions.read', 'support.read', 'users.read', 'visits.read', 'audit.read']);
  const overview = useQuery({ queryKey: ['overview'], queryFn: ({ signal }) => getOverview(signal), enabled: overviewAllowed, refetchInterval: 60_000, retry: false });
  useCacheLoginStats(overviewAllowed);
  useEffect(() => {
    touchAdminActivity();
    const mark = () => touchAdminActivity();
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    const timer = window.setInterval(() => {
      if (adminIdleExpired()) useAuthStore.getState().expire();
    }, 30_000);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const live = chatSocket();
    if (!live) return undefined;
    const onChange = (payload: { resources?: string[] }) => {
      const resources = Array.isArray(payload?.resources) ? payload.resources : [];
      const keys = resources.flatMap((resource) => (
        resource === 'visits' ? ['visits', 'visit']
          : resource === 'enquiries' ? ['buy-enquiries', 'buy-enquiry', 'overview']
            : resource === 'deals' ? ['sales-deals', 'sales-deal', 'overview']
              : resource === 'locations' ? ['locations']
                : resource === 'boostOrders' ? ['boost-orders']
                  : [resource]
      ));
      if (!keys.length) return;
      keys.forEach((key) => { void qc.invalidateQueries({ queryKey: [key] }); });
    };
    live.on('records:changed', onChange);
    return () => { live.off('records:changed', onChange); };
  }, [qc, token]);
  const badges = overview.data?.navBadges ?? {};

  const toggleSidebar = () => {
    if (mode === 'hidden') return setMobileOpen((o) => !o);
    const next: Mode = mode === 'expanded' ? 'collapsed' : 'expanded';
    try {
      localStorage.setItem(COLLAPSE_KEY, String(next === 'collapsed'));
    } catch {
      /* storage unavailable */
    }
    setMode(next);
  };

  const logout = () => {
    const rt = useAuthStore.getState().session?.refreshToken;
    if (rt) void logoutAdmin(rt).catch(() => undefined);
    markIntentionalSignOut();
    useAuthStore.getState().signOut();
    qc.clear();
    navigate('/login');
  };

  const hidden = mode === 'hidden';
  const collapsed = mode === 'collapsed';
  const inset = hidden ? 0 : collapsed ? 64 : 240;
  const isOverview = pathname === OVERVIEW.path;
  const tab = findTab(pathname);
  const section = findSection(pathname);
  const allowedSection = section && allowedSections(admin).find((s) => s.id === section.id);
  const tabs = !isOverview && allowedSection ? allowedSection.tabs : [];
  const pageTitle = isOverview ? 'Overview' : tab ? tab.label : 'Admin';

  return (
    <div className={styles.shell}>
      {mobileOpen && <button type="button" aria-label="Close menu" className={styles.scrim} onClick={() => setMobileOpen(false)} />}
      <Sidebar mode={mode} mobileOpen={mobileOpen} onToggle={toggleSidebar} badges={badges} onLogout={logout} />

      <div className={styles.content} style={{ marginLeft: inset }}>
        <header className={styles.header} style={{ left: inset, padding: isMd ? '0 24px' : '0 16px' }}>
          {hidden && (
            <button type="button" className={styles.iconBtn} onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Icon name="menu" size={20} />
            </button>
          )}
          {(hidden || collapsed) && (
            <button type="button" className={styles.hBrand} onClick={() => navigate(OVERVIEW.path)}>BUILTGLORY</button>
          )}
          <h1 className={styles.pageTitle} style={{ fontSize: isMd ? 20 : 18 }}>{pageTitle}</h1>
          {isMd && <GlobalSearch />}
          <div className={styles.right}>
            {!isMd && <MobileSearch open={mSearchOpen} setOpen={(v) => { setMSearchOpen(v); if (v) setNotifOpen(false); }} />}
            <NotificationsMenu open={notifOpen} setOpen={(v) => { setNotifOpen(v); if (v) setMSearchOpen(false); }} />
          </div>
        </header>

        <div className={styles.body}>
          {offline && <div className={styles.offline} role="alert">⚠️ You are offline. Changes may not be saved.</div>}
          {backOnline && <div className={styles.online} role="status">✅ Back online!</div>}
          {tabs.length > 0 && (
            <div className={styles.tabsBar}>
              <nav ref={tabsRef} aria-label={section!.label + ' tabs'} className={styles.tabs}>
                {tabs.map((t) => (
                  <Link key={t.path} to={t.path} className={[styles.tab, t.path === pathname ? styles.tabActive : ''].join(' ')} aria-current={t.path === pathname ? 'page' : undefined}>
                    {t.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          <main className={styles.main} style={{ padding: isMd ? 24 : 16 }}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

/** Shown while a lazily loaded screen's code downloads. */
function PageFallback() {
  return (
    <div aria-busy="true" style={{ margin: '0 auto', display: 'flex', maxWidth: 1600, flexDirection: 'column', gap: 16 }}>
      <Skeleton style={{ height: 32, width: 240, borderRadius: 8 }} />
      <Skeleton style={{ height: 420, borderRadius: 12 }} />
    </div>
  );
}
