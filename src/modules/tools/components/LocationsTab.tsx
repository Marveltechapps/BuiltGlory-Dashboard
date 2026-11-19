import { useQuery, useQueryClient } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { formatApiError } from '../../../lib/apiClient';
import { listProperties } from '../../../services/properties';
import {
  createLocation,
  deleteLocation,
  formatCenter,
  listLocations,
  parseLatLng,
  slugifyLocationKey,
  squareBoundaryAround,
  type LocationRecord,
} from '../../../services/locations';
import { askConfirm, toast } from '../../../store/uiStore';

/**
 * Tools › Locations — CRUD against GET/POST/PATCH/DELETE /admin/locations
 * (cities, localities, zones). Property counts come from live property addresses.
 */
export function LocationsTab() {
  const f = useFormFields();
  const qc = useQueryClient();
  const locQ = useQuery({ queryKey: ['locations'], queryFn: ({ signal }) => listLocations({}, signal) });
  const propsQ = useQuery({ queryKey: ['properties'], queryFn: ({ signal }) => listProperties(signal) });
  const keys = [['locations']];
  const create = useRefreshingMutation((b: Parameters<typeof createLocation>[0]) => createLocation(b), keys);
  const remove = useRefreshingMutation((id: string) => deleteLocation(id), keys);

  const state = locQ.isPending ? 'loading' : locQ.isError ? 'error' : 'ok';
  if (state !== 'ok') {
    return (
      <RecordDetailView
        state={state}
        isPage
        onRetry={() => void locQ.refetch()}
        errorTitle="Could not load locations"
      />
    );
  }

  const items = locQ.data?.items ?? [];
  const cities = items.filter((x) => x.kind === 'city');
  const localities = items.filter((x) => x.kind === 'locality');
  const zones = items.filter((x) => x.kind === 'zone');
  const props = (propsQ.data?.items ?? []).filter((p) => !p.isDeleted);
  const pc = (city: string) => props.filter((p) => p.city.toLowerCase() === city.toLowerCase()).length;
  const cityByName = (name: string) => cities.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const cityByKey = (key: string) => cities.find((c) => c.key === key || c.cityKey === key);
  const err = create.error || remove.error;

  const afterOk = (msg: string) => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ['locations'] });
  };

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Locations"
      meta="Cities, localities and searchable map zones"
      single
      banners={[
        err ? { text: '⚠️ Last change was not saved: ' + formatApiError(err), tone: 'error' } : null,
        locQ.data?.truncated ? { text: 'Showing the first loaded pages of locations. Narrow the list if needed.', tone: 'muted' } : null,
      ]}
      main={[
        {
          title: 'Cities',
          rows: cities.map((x) => ({
            key: x.id,
            title: x.name,
            sub: x.state,
            right: pc(x.name) + ' properties · ' + localities.filter((l) => l.cityKey === x.cityKey).length + ' localities',
            actions: [{
              label: 'Delete',
              variant: 'red' as const,
              onClick: () => {
                if (pc(x.name) > 0) return void toast('City has properties — cannot delete');
                askConfirm({
                  title: 'Delete ' + x.name + '?',
                  confirmLabel: 'Delete',
                  tone: 'destructive',
                  onConfirm: () => remove.mutateAsync(x.id).then(() => afterOk('City deleted: ' + x.name)),
                });
              },
            }],
          })),
          empty: cities.length ? '' : 'No cities yet. Add a city to seed the locations collection.',
          form: [f.inp('ct.c', 'City'), f.inp('ct.s', 'State')],
          actions: [
            btn('+ Add City', () => {
              if (!f.need({ 'ct.c': 'City is required', 'ct.s': 'State is required' })) return;
              const name = f.str('ct.c').trim();
              const key = slugifyLocationKey(name);
              if (!key) return void f.fail('ct.c', 'Enter a valid city name');
              if (cities.some((x) => x.key === key || x.name.toLowerCase() === name.toLowerCase())) return void f.fail('ct.c', 'City already exists');
              create.mutate(
                { kind: 'city', name, key, cityKey: key, state: f.str('ct.s').trim(), active: true },
                { onSuccess: () => { f.clear('ct.'); afterOk('✅ City added'); } },
              );
            }, 'primary', { loading: create.isPending }),
          ],
        },
        {
          title: 'Localities',
          banners: cities.length ? [] : [{ text: 'Add a city before managing localities.', tone: 'warn' }],
          rows: localities.map((l) => ({
            key: l.id,
            title: l.name,
            sub: cityByKey(l.cityKey)?.name || l.cityKey,
            right: props.filter((p) => p.locality.toLowerCase() === l.name.toLowerCase()).length + ' properties',
            actions: [{
              label: 'Delete',
              variant: 'red' as const,
              onClick: () => askConfirm({
                title: 'Delete ' + l.name + '?',
                confirmLabel: 'Delete',
                tone: 'destructive',
                onConfirm: () => remove.mutateAsync(l.id).then(() => afterOk('Locality deleted: ' + l.name)),
              }),
            }],
          })),
          empty: localities.length ? '' : 'No localities yet',
          form: [f.inp('lc.n', 'Locality'), f.inp('lc.c', 'City', { type: 'select', options: cities.map((x) => x.name), placeholder: 'Select city' })],
          actions: [
            btn('+ Add Locality', () => {
              if (!f.need({ 'lc.n': 'Locality is required', 'lc.c': 'City is required' })) return;
              const parent = cityByName(f.str('lc.c'));
              if (!parent) return void f.fail('lc.c', 'Select a saved city');
              const name = f.str('lc.n').trim();
              const key = slugifyLocationKey(name);
              if (!key) return void f.fail('lc.n', 'Enter a valid locality name');
              create.mutate(
                { kind: 'locality', name, key, cityKey: parent.cityKey, parentId: parent.id, active: true },
                { onSuccess: () => { f.clear('lc.'); afterOk('✅ Locality added'); } },
              );
            }, 'primary', { loading: create.isPending, disabled: !cities.length }),
          ],
        },
        {
          title: 'Map Zones',
          subtitle: 'Map zones define searchable areas in the app map view (B-17)',
          rows: zones.map((z) => ({
            key: z.id,
            title: z.name,
            sub: (cityByKey(z.cityKey)?.name || z.cityKey) + ' · ' + (formatCenter(z) || 'polygon'),
            actions: [{
              label: 'Delete',
              variant: 'red' as const,
              onClick: () => askConfirm({
                title: 'Delete zone ' + z.name + '?',
                confirmLabel: 'Delete',
                tone: 'destructive',
                onConfirm: () => remove.mutateAsync(z.id).then(() => afterOk('Zone deleted')),
              }),
            }],
          })),
          empty: zones.length ? '' : 'No map zones yet',
          form: [
            f.inp('z.n', 'Zone name'),
            f.inp('z.c', 'City', { type: 'select', options: cities.map((x) => x.name), placeholder: 'Select city' }),
            f.inp('z.xy', 'Coordinates (lat,lng)', { full: true }),
          ],
          actions: [
            btn('+ Add Zone', () => {
              if (!f.need({ 'z.n': 'Zone name is required', 'z.c': 'City is required', 'z.xy': 'Coordinates are required' })) return;
              const parent = cityByName(f.str('z.c'));
              if (!parent) return void f.fail('z.c', 'Select a saved city');
              const center = parseLatLng(f.str('z.xy'));
              if (!center) return void f.fail('z.xy', 'Use lat,lng format');
              const name = f.str('z.n').trim();
              const key = slugifyLocationKey(name);
              if (!key) return void f.fail('z.n', 'Enter a valid zone name');
              create.mutate(
                {
                  kind: 'zone',
                  name,
                  key,
                  cityKey: parent.cityKey,
                  parentId: parent.id,
                  center,
                  boundary: squareBoundaryAround(center),
                  active: true,
                },
                { onSuccess: () => { f.clear('z.'); afterOk('✅ Zone added'); } },
              );
            }, 'primary', { loading: create.isPending, disabled: !cities.length }),
          ],
        },
      ]}
    />
  );
}

export type { LocationRecord };
