import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { formatApiError } from '../../../lib/apiClient';
import { listProperties } from '../../../services/properties';
import { askConfirm, toast } from '../../../store/uiStore';
import { CONFIG_RECORDS, useToolsContent } from '../hooks/useToolsContent';
import { uid } from './toolsShared';

interface City { id: string; city: string; state: string; active: boolean }
interface Locality { id: string; locality: string; city: string; active: boolean }
interface Zone { id: string; name: string; city: string; coordinates: string; active: boolean }

const s = (v: unknown) => (v == null ? '' : String(v));

/**
 * Tools › Locations — cities, localities and map zones kept in the `tools-operational-config`
 * CMS record (no dedicated locations endpoint). Until a list is saved, cities and localities are
 * derived from the addresses of real properties.
 */
export function LocationsTab() {
  const f = useFormFields();
  const tc = useToolsContent();
  const propsQ = useQuery({ queryKey: ['properties'], queryFn: ({ signal }) => listProperties(signal) });
  const state = tc.q.isPending ? 'loading' : tc.q.isError ? 'error' : 'ok';
  if (state !== 'ok') return <RecordDetailView state={state} isPage onRetry={() => void tc.q.refetch()} errorTitle="Could not load locations" />;

  const props = (propsQ.data?.items ?? []).filter((p) => !p.isDeleted);
  const meta = tc.meta(CONFIG_RECORDS.toolsConfig!.slug);
  const storedCities = tc.list<City>(CONFIG_RECORDS.toolsConfig!.slug, 'cities');
  const storedLocs = tc.list<Locality>(CONFIG_RECORDS.toolsConfig!.slug, 'localities');
  const derivedCities: City[] = [...new Map(props.filter((p) => p.city).map((p) => [p.city.toLowerCase(), { id: 'p-' + p.city, city: p.city, state: p.state, active: true }])).values()];
  const derivedLocs: Locality[] = [...new Map(props.filter((p) => p.locality).map((p) => [(p.locality + '|' + p.city).toLowerCase(), { id: 'p-' + p.locality + p.city, locality: p.locality, city: p.city, active: true }])).values()];
  const cities = (storedCities?.length ? storedCities : derivedCities).map((c) => ({ ...c, city: s(c.city), state: s(c.state) }));
  const localities = (storedLocs?.length ? storedLocs : derivedLocs).map((l) => ({ ...l, locality: s(l.locality ?? (l as unknown as { name?: string }).name), city: s(l.city) }));
  const zones = (tc.list<Zone>(CONFIG_RECORDS.toolsConfig!.slug, 'zones') ?? []).map((z) => ({ ...z, name: s(z.name), city: s(z.city), coordinates: s(z.coordinates) }));
  const pc = (city: string) => props.filter((p) => p.city.toLowerCase() === city.toLowerCase()).length;
  const save = (patch: Record<string, unknown>, msg: string) => tc.save.mutateAsync({ rec: CONFIG_RECORDS.toolsConfig!, metadata: { ...meta, cities, localities, zones, ...patch } }).then(() => { toast(msg); return true; }).catch(() => false);

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Locations"
      meta="Cities, localities and searchable map zones"
      single
      banners={[tc.save.error ? { text: '⚠️ Last change was not saved: ' + formatApiError(tc.save.error), tone: 'error' } : null]}
      main={[
        {
          title: 'Cities',
          banners: storedCities?.length || !cities.length ? [] : [{ text: 'Derived from property addresses — add or delete a city to save the list.', tone: 'muted' }],
          rows: cities.map((x) => ({
            key: x.id,
            title: x.city,
            sub: x.state,
            right: pc(x.city) + ' properties · ' + localities.filter((l) => l.city.toLowerCase() === x.city.toLowerCase()).length + ' localities',
            actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => (pc(x.city) ? toast('City has properties — cannot delete') : askConfirm({ title: 'Delete ' + x.city + '?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => save({ cities: cities.filter((c) => c.id !== x.id) }, 'City deleted: ' + x.city) })) }],
          })),
          empty: cities.length ? '' : 'No cities yet. Add a city or import properties to seed locations automatically.',
          form: [f.inp('ct.c', 'City'), f.inp('ct.s', 'State')],
          actions: [
            btn('+ Add City', () => {
              if (!f.need({ 'ct.c': 'City is required', 'ct.s': 'State is required' })) return;
              const name = f.str('ct.c').trim();
              if (cities.some((x) => x.city.toLowerCase() === name.toLowerCase())) return void f.fail('ct.c', 'City already exists');
              void save({ cities: [...cities, { id: uid('C'), city: name, state: f.str('ct.s').trim(), active: true }] }, '✅ City added').then((ok) => ok && f.clear('ct.'));
            }, 'primary', { loading: tc.save.isPending }),
          ],
        },
        {
          title: 'Localities',
          banners: cities.length ? [] : [{ text: 'Add a city before managing localities.', tone: 'warn' }],
          rows: localities.map((l) => ({
            key: l.id,
            title: l.locality,
            sub: l.city,
            right: props.filter((p) => p.locality.toLowerCase() === l.locality.toLowerCase()).length + ' properties',
            actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => void save({ localities: localities.filter((x) => x.id !== l.id) }, 'Locality deleted: ' + l.locality) }],
          })),
          empty: localities.length ? '' : 'No localities yet',
          form: [f.inp('lc.n', 'Locality'), f.inp('lc.c', 'City', { type: 'select', options: cities.map((x) => x.city), placeholder: 'Select city' })],
          actions: [
            btn('+ Add Locality', () => {
              if (!f.need({ 'lc.n': 'Locality is required', 'lc.c': 'City is required' })) return;
              void save({ localities: [...localities, { id: uid('L'), locality: f.str('lc.n').trim(), city: f.str('lc.c'), active: true }] }, '✅ Locality added').then((ok) => ok && f.clear('lc.'));
            }, 'primary', { loading: tc.save.isPending }),
          ],
        },
        {
          title: 'Map Zones',
          subtitle: 'Map zones define searchable areas in the app map view (B-17)',
          rows: zones.map((z) => ({ key: z.id, title: z.name, sub: z.city + ' · ' + z.coordinates, actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => void save({ zones: zones.filter((x) => x.id !== z.id) }, 'Zone deleted') }] })),
          empty: zones.length ? '' : 'No map zones yet',
          form: [f.inp('z.n', 'Zone name'), f.inp('z.c', 'City', { type: 'select', options: cities.map((x) => x.city), placeholder: 'Select city' }), f.inp('z.xy', 'Coordinates (lat,lng or polygon)', { full: true })],
          actions: [
            btn('+ Add Zone', () => {
              if (!f.need({ 'z.n': 'Zone name is required', 'z.c': 'City is required', 'z.xy': 'Coordinates are required' })) return;
              if (!/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?/.test(f.str('z.xy').trim())) return void f.fail('z.xy', 'Use lat,lng format');
              void save({ zones: [...zones, { id: uid('Z'), name: f.str('z.n').trim(), city: f.str('z.c'), coordinates: f.str('z.xy').trim(), active: true }] }, '✅ Zone added').then((ok) => ok && f.clear('z.'));
            }, 'primary', { loading: tc.save.isPending }),
          ],
        },
      ]}
    />
  );
}
