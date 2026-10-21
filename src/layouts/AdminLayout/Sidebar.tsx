import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OVERVIEW } from '../../constants/nav';
import { allowedSections } from '../../constants/permissions';
import { Icon } from '../../components/ui/Icon';
import { LogoMark } from '../../components/ui/LogoMark';
import { useClickOutside } from '../../hooks/useDomUtils';
import { useSession } from '../../hooks/useSession';
import { initials } from '../../lib/format';
import styles from './AdminLayout.module.css';

const BADGE: Record<string, [string, string]> = { red: ['#fee2e2', '#b91c1c'], blue: ['#dbeafe', '#1d4ed8'], orange: ['#ffedd5', '#c2410c'] };

interface SidebarProps {
  mode: 'expanded' | 'collapsed' | 'hidden';
  mobileOpen: boolean;
  onToggle: () => void;
  badges: Record<string, number>;
  onLogout: () => void;
}

export function Sidebar({ mode, mobileOpen, onToggle, badges, onLogout }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { admin, name, can } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [tip, setTip] = useState<{ top: number; left: number; label: string } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  useClickOutside(profileRef, profileOpen, () => setProfileOpen(false));

  const collapsed = mode === 'collapsed';
  const hiddenNow = mode === 'hidden' && !mobileOpen;
  const showTip = (e: React.MouseEvent | React.FocusEvent, label: string) => {
    if (!collapsed) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ top: r.top + r.height / 2, left: r.right + 8, label });
  };
  const hideTip = () => setTip(null);

  const sections = allowedSections(admin);
  const items = [
    { key: 'overview', label: OVERVIEW.label, icon: OVERVIEW.icon, href: OVERVIEW.path, active: pathname === OVERVIEW.path, badge: null as null | { value: string; bg: string; fg: string } },
    ...sections.map((s) => {
      const c = badges[s.id] || 0;
      const v = s.id === 'enquiries' || s.id === 'users' ? 'red' : s.id === 'sales' ? 'blue' : 'orange';
      return {
        key: s.id,
        label: s.label,
        icon: s.icon,
        href: s.tabs[0]!.path,
        active: s.tabs.some((t) => t.path === pathname),
        badge: c > 0 ? { value: c > 99 ? '99+' : String(c), bg: BADGE[v]![0], fg: BADGE[v]![1] } : null,
      };
    }),
  ];

  const go = (path: string) => {
    setProfileOpen(false);
    navigate(path);
  };
  const pop = collapsed
    ? { bottom: 8, left: '100%', right: 'auto', width: 224, marginLeft: 8 }
    : { bottom: 'calc(100% + 8px)', left: 16, right: 16, width: 'auto', marginLeft: 0 };

  return (
    <>
      <aside
        className={styles.sidebar}
        style={{ width: collapsed ? 64 : 240, transform: hiddenNow ? 'translateX(-100%)' : 'translateX(0)', boxShadow: mobileOpen ? '0 25px 50px -12px rgb(0 0 0 / 0.25)' : 'none' }}
        aria-hidden={hiddenNow}
      >
        <div className={styles.sbHead} data-collapsed={collapsed || undefined}>
          <button type="button" className={styles.brandBtn} onClick={() => go(OVERVIEW.path)} aria-label="BuiltGlory">
            <LogoMark size={collapsed ? 28 : 36} />
            {!collapsed && (
              <span className={styles.brandText}>
                <span className={styles.brand}>BUILTGLORY</span>
                <span className={styles.brandSub}>Admin Dashboard</span>
              </span>
            )}
          </button>
          <button type="button" className={styles.toggle} onClick={() => { hideTip(); onToggle(); }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Main">
          {items.map((it) => (
            <Link
              key={it.key}
              to={it.href}
              aria-label={collapsed ? it.label : undefined}
              aria-current={it.active ? 'page' : undefined}
              className={[styles.navItem, it.active ? styles.navActive : ''].join(' ')}
              style={{ padding: collapsed ? '8px 8px' : '8px 12px', justifyContent: collapsed ? 'center' : 'flex-start' }}
              onMouseEnter={(e) => showTip(e, it.label)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(e, it.label)}
              onBlur={hideTip}
              onClick={hideTip}
            >
              <Icon name={it.icon} size={16} />
              {!collapsed && (
                <>
                  <span className={styles.navLabel}>{it.label}</span>
                  {it.badge && <span className={styles.navBadge} style={{ background: it.badge.bg, color: it.badge.fg }}>{it.badge.value}</span>}
                </>
              )}
            </Link>
          ))}
        </nav>

        <div ref={profileRef} className={styles.sbFoot} style={{ padding: collapsed ? 8 : 16 }}>
          <button
            type="button"
            className={styles.acct}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
            onClick={() => { setProfileOpen((o) => !o); hideTip(); }}
            onMouseEnter={(e) => !profileOpen && showTip(e, name)}
            onMouseLeave={hideTip}
            aria-label={collapsed ? name : 'Account menu'}
            aria-expanded={profileOpen}
          >
            <span className={styles.avatar}>{admin ? initials(name) : 'AK'}</span>
            {!collapsed && (
              <>
                <span className={styles.acctText}>
                  <span className={styles.acctName}>{name}</span>
                  <span className={styles.acctRole}>{admin?.role || '—'}</span>
                </span>
                <span className={styles.chev} style={{ transform: profileOpen ? 'rotate(180deg)' : 'none' }}><Icon name="chevron-down" size={16} /></span>
              </>
            )}
          </button>
          {profileOpen && (
            <div className={styles.pop} style={pop} role="menu">
              <button type="button" role="menuitem" className={styles.popItem} onClick={() => go('/admin/settings/general')}>
                <span className={styles.popIcon}><Icon name="user-round" size={16} /></span>My Profile
              </button>
              <button type="button" role="menuitem" className={styles.popItem} onClick={() => go('/admin/settings/general')}>
                <span className={styles.popIcon}><Icon name="settings" size={16} /></span>Settings
              </button>
              {can('admin.access.manage') && (
                <button type="button" role="menuitem" className={styles.popItem} onClick={() => go('/admin/settings/access')}>
                  <span className={styles.popIcon}><Icon name="shield-check" size={16} /></span>Access Control
                </button>
              )}
              <hr className={styles.popHr} />
              <button type="button" role="menuitem" className={styles.popItem} style={{ color: '#ef4444' }} onClick={() => { setProfileOpen(false); onLogout(); }}>
                <Icon name="log-out" size={16} />Logout
              </button>
            </div>
          )}
        </div>
      </aside>
      {tip && <div className={styles.tip} style={{ top: tip.top, left: tip.left }}>{tip.label}</div>}
    </>
  );
}
