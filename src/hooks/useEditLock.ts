import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { claimLock, getLock, releaseLock } from '../services/workflow';
import type { PageBanner } from '../types/detail';
import type { EditLock, EntityType } from '../types/workflow';

/**
 * Concurrent-viewer notice: claims the record's edit lock while the page is open
 * (POST/DELETE /admin/workflow/:entityType/:entityId/lock) and surfaces the reference
 * "Another admin may be viewing this record" banner when someone else holds it.
 */
export function useEditLock(type: EntityType, id: string): PageBanner | null {
  const [holder, setHolder] = useState<EditLock | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!/^[a-f0-9]{24}$/i.test(id)) return;
    let alive = true;
    let mine = false;
    (async () => {
      try {
        const cur = await getLock(type, id);
        if (!alive) return;
        if (cur && !cur.isMine) return setHolder(cur);
        const claimed = await claimLock(type, id);
        mine = !!claimed?.isMine;
        if (alive && claimed && !claimed.isMine) setHolder(claimed);
      } catch {
        /* lock service unavailable — no banner */
      }
    })();
    const renew = window.setInterval(() => {
      if (mine) void claimLock(type, id).catch(() => undefined);
    }, 10 * 60 * 1000);
    const releaseOnClose = () => {
      if (!mine) return;
      const token = useAuthStore.getState().session?.accessToken;
      if (!token) return;
      void fetch(`/api/v1/admin/workflow/${type}/${id}/lock`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        keepalive: true,
      });
    };
    window.addEventListener('pagehide', releaseOnClose);
    return () => {
      alive = false;
      window.clearInterval(renew);
      window.removeEventListener('pagehide', releaseOnClose);
      if (mine) void releaseLock(type, id).catch(() => undefined);
    };
  }, [type, id]);
  if (!holder || hidden) return null;
  return { text: '👀 Another admin may be viewing this record' + (holder.adminName ? ' (' + holder.adminName + ')' : ''), tone: 'warn', dismiss: () => setHidden(true) };
}
