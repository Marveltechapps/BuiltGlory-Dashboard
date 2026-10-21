import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatApiError } from '../../../lib/apiClient';
import {
  deleteProperty, deletePropertyPermanently, listProperties, restoreProperty, updateProperty, updatePropertyStatus,
} from '../../../services/properties';
import { toast } from '../../../store/uiStore';
import type { Property, PropertyPayload } from '../../../types/properties';

/** GET /admin/properties (all pages, including soft-deleted for the Deleted Properties panel). */
export function useProperties() {
  return useQuery({ queryKey: ['properties'], queryFn: ({ signal }) => listProperties(signal) });
}

type Status = Parameters<typeof updatePropertyStatus>[1]['status'];

/**
 * Listing actions shared by the list, grid, row menu and detail page. Each runs the real
 * endpoint(s), refreshes the property queries and toasts the API error on failure.
 */
export function usePropertyActions() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const refresh = (ids: string[] = []) => {
    void qc.invalidateQueries({ queryKey: ['properties'] });
    void qc.invalidateQueries({ queryKey: ['overview'] });
    ids.forEach((id) => void qc.invalidateQueries({ queryKey: ['property', id] }));
  };

  async function run<T>(ids: string[], fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const out = await fn();
      if (okMsg) toast(okMsg);
      return out;
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
      return undefined;
    } finally {
      setBusy(false);
      refresh(ids);
    }
  }

  const patch = (p: Property, body: PropertyPayload, msg?: string) => run([p.id], () => updateProperty(p.id, body), msg);
  const status = (p: Property, s: Status, msg?: string, extra: { reason?: string; notes?: string } = {}) => run([p.id], () => updatePropertyStatus(p.id, { status: s, ...extra }), msg);

  return {
    busy,
    refresh,
    patch,
    status,
    /** Hidden from the app without changing the backend status ("Paused" in the reference UI). */
    pause: (p: Property, msg = '⏸ Listing paused') => patch(p, { isVisibleOnApp: false }, msg),
    /** Draft / paused / sold → available and visible on the app. */
    publish: (p: Property, msg = '▶️ Listing published') =>
      run([p.id], async () => {
        if (p.status !== 'available') await updatePropertyStatus(p.id, { status: 'available' });
        if (!p.isVisibleOnApp || p.status !== 'available') await updateProperty(p.id, { isVisibleOnApp: true });
      }, msg),
    markSold: (p: Property, msg = '✅ Marked as sold') =>
      run([p.id], async () => {
        await updatePropertyStatus(p.id, { status: 'sold' });
        if (p.isFeatured) await updateProperty(p.id, { isFeatured: false });
      }, msg),
    moveToAvailable: (p: Property) =>
      run([p.id], async () => {
        await updateProperty(p.id, { isUpcoming: false, isVisibleOnApp: true });
        if (p.status !== 'available') await updatePropertyStatus(p.id, { status: 'available' });
      }, '✅ Moved to Available'),
    remove: (ids: string[], msg = '🗑 Moved to Deleted Properties') => run(ids, () => Promise.all(ids.map((id) => deleteProperty(id))), msg),
    restore: (p: Property) => run([p.id], () => restoreProperty(p.id), '♻️ Property restored'),
    purge: (p: Property) => run([p.id], () => deletePropertyPermanently(p.id), 'Property permanently deleted'),
    bulk: (list: Property[], body: PropertyPayload, msg: string) => run(list.map((p) => p.id), () => Promise.all(list.map((p) => updateProperty(p.id, body))), msg),
  };
}

export type PropertyActions = ReturnType<typeof usePropertyActions>;
