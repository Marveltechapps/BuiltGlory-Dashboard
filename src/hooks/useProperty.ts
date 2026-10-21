import { useQuery } from '@tanstack/react-query';
import { getProperty } from '../services/properties';

const isId = (id?: string | null) => !!id && /^[a-f0-9]{24}$/i.test(id);

/** Live property record (GET /admin/properties/:id) for property cards and sold/paused banners. */
export function useProperty(id: string | null | undefined, enabled = true) {
  return useQuery({ queryKey: ['property', id], queryFn: ({ signal }) => getProperty(id!, signal), enabled: enabled && isId(id), retry: false, staleTime: 60_000 });
}
