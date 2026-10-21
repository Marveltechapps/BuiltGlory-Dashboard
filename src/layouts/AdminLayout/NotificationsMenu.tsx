import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useClickOutside } from '../../hooks/useDomUtils';
import { useSession } from '../../hooks/useSession';
import { relativeLong } from '../../lib/format';
import { listNotifications, markNotificationRead } from '../../services/notifications';
import type { AdminNotification } from '../../types/overview';
import styles from './AdminLayout.module.css';

/** Bell + dropdown: GET /admin/notifications, PATCH /admin/notifications/:id { isRead: true }. */
export function NotificationsMenu({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useSession();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const allowed = can('support.read');
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['notifications'], queryFn: ({ signal }) => listNotifications(signal), enabled: allowed, refetchInterval: 60_000, retry: false });
  const list = allowed ? data ?? [] : [];
  const unread = list.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => markNotificationRead(id))),
    onMutate: (ids) => {
      qc.setQueryData<AdminNotification[]>(['notifications'], (old) => old?.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={styles.iconBtn} onClick={() => setOpen(!open)} aria-label="Notifications" aria-expanded={open}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className={styles.bellBadge}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className={styles.drop} style={{ width: 'min(380px, calc(100vw - 1.5rem))' }}>
          <div className={styles.nHead}>
            <span style={{ fontWeight: 600 }}>Notifications</span>
            {unread > 0 && (
              <>
                <span className={styles.nUnread}>{unread} unread</span>
                <button type="button" className={styles.nMark} onClick={() => markRead.mutate(list.filter((n) => !n.read).map((n) => n.id))}>Mark all read</button>
              </>
            )}
          </div>
          {allowed && isPending && <div style={{ padding: '8px 16px 16px' }}><SkeletonRows count={4} /></div>}
          {allowed && isError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', color: 'rgba(220,38,38,0.7)' }}><Icon name="alert-circle" size={32} /></span>
              <p style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>Could not load notifications.</p>
              <button type="button" className={styles.nMark} style={{ marginLeft: 0, marginTop: 8 }} onClick={() => void refetch()}>Retry</button>
            </div>
          )}
          {(!allowed || (!isPending && !isError)) && list.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
              <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.5)' }}><Icon name="bell" size={40} /></span>
              <p style={{ marginTop: 8, fontWeight: 500 }}>All caught up!</p>
              <p style={{ fontSize: 14, lineHeight: '20px', color: '#64748b' }}>No new notifications</p>
            </div>
          )}
          {list.length > 0 && (
            <ul className={styles.nList}>
              {list.map((n, i) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={styles.nItem}
                    style={{ borderBottom: i === list.length - 1 ? 0 : '1px solid #e2e8f0', background: n.read ? 'transparent' : 'rgba(239,246,255,0.4)' }}
                    onClick={() => {
                      if (!n.read) markRead.mutate([n.id]);
                      setOpen(false);
                      navigate(n.route);
                    }}
                  >
                    <span className={styles.nIcon} style={{ background: n.read ? '#f1f5f9' : 'rgba(37,99,235,0.1)' }}>{n.icon}</span>
                    <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
                      <span className={styles.nTitle} style={{ fontWeight: n.read ? 500 : 600 }}>{n.title}</span>
                      <span className={styles.nMsg}>{n.message}</span>
                      <span className={styles.nTime}>{relativeLong(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className={styles.nDot} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.nFoot}>
            <button type="button" className="bg-link-btn" style={{ fontWeight: 400 }} onClick={() => { setOpen(false); navigate('/admin/settings/audit'); }}>View notification history</button>
          </div>
        </div>
      )}
    </div>
  );
}
