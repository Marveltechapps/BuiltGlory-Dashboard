import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatApiError } from '../../../lib/apiClient';
import {
  deleteProperty, deletePropertyPermanently, listProperties, restoreProperty, updateProperty, updatePropertyStatus,
} from '../../../services/properties';
import { toast } from '../../../store/uiStore';
import { useSession } from '../../../hooks/useSession';
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
  const { can } = useSession();
  const [busy, setBusy] = useState(false);
  const allow = (permission: 'properties.write' | 'properties.publish') => {
    if (can(permission)) return true;
    toast('You do not have permission for this action.');
    return false;
  };

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

  const skip = () => Promise.resolve(undefined);
  const patch = (p: Property, body: PropertyPayload, msg?: string) => allow('properties.write') ? run([p.id], () => updateProperty(p.id, body), msg) : skip();
  const status = (p: Property, s: Status, msg?: string, extra: { reason?: string; notes?: string } = {}) => allow('properties.publish') ? run([p.id], () => updatePropertyStatus(p.id, { status: s, ...extra }), msg) : skip();

  return {
    busy,
    refresh,
    patch,
    status,
    /** Hidden from the app without changing the backend status ("Paused" in the reference UI). */
    pause: (p: Property, msg = '⏸ Listing paused') => patch(p, { isVisibleOnApp: false }, msg),
    /** Draft / paused / sold → available and visible on the app. */
    publish: (p: Property, msg = '▶️ Listing published') =>
      allow('properties.publish') ? run([p.id], async () => {
        if (p.status !== 'available') await updatePropertyStatus(p.id, { status: 'available' });
        if (!p.isVisibleOnApp || p.status !== 'available') await updateProperty(p.id, { isVisibleOnApp: true });
      }, msg) : skip(),
    markSold: (p: Property, msg = '✅ Marked as sold') =>
      allow('properties.publish') ? run([p.id], async () => {
        await updatePropertyStatus(p.id, { status: 'sold' });
        if (p.isFeatured) await updateProperty(p.id, { isFeatured: false });
      }, msg) : skip(),
    moveToAvailable: (p: Property) =>
      allow('properties.publish') && allow('properties.write') ? run([p.id], async () => {
        await updateProperty(p.id, { isUpcoming: false, isVisibleOnApp: true });
        if (p.status !== 'available') await updatePropertyStatus(p.id, { status: 'available' });
      }, '✅ Moved to Available') : skip(),
    remove: (ids: string[], msg = '🗑 Moved to Deleted Properties') => allow('properties.write') ? run(ids, () => Promise.all(ids.map((id) => deleteProperty(id))), msg) : skip(),
    restore: (p: Property) => allow('properties.write') ? run([p.id], () => restoreProperty(p.id), '♻️ Property restored') : skip(),
    purge: (p: Property) => allow('properties.write') ? run([p.id], () => deletePropertyPermanently(p.id), 'Property permanently deleted') : skip(),
    bulk: (list: Property[], body: PropertyPayload, msg: string) => allow('properties.write') ? run(list.map((p) => p.id), () => Promise.all(list.map((p) => updateProperty(p.id, body))), msg) : skip(),
  };
}

export type PropertyActions = ReturnType<typeof usePropertyActions>;
