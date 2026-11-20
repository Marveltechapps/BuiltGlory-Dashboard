import { useEffect, useState } from 'react';
import { forwardGeocode } from '../../services/geo/geoService';

/** OpenStreetMap embed for a saved coordinate, or a lookup of the written address. */
export function PropertyMap({
  latitude,
  longitude,
  query,
  height = 240,
  onFound,
}: {
  latitude?: number | null;
  longitude?: number | null;
  query?: string;
  height?: number;
  onFound?: (latitude: number, longitude: number) => void;
}) {
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(
    typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null,
  );
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      setPoint({ latitude, longitude });
      return undefined;
    }
    const q = (query || '').trim();
    if (q.length < 3) {
      setStatus('Add an address to place this property on the map.');
      return undefined;
    }
    let cancelled = false;
    setStatus('Finding this address on the map…');
    void forwardGeocode(q)
      .then((place) => {
        if (cancelled) return;
        if (!place) {
          setStatus('No map location was found for that address.');
          return;
        }
        setPoint({ latitude: place.latitude, longitude: place.longitude });
        setStatus('');
        onFound?.(place.latitude, place.longitude);
      })
      .catch(() => {
        if (!cancelled) setStatus('The map lookup did not respond. Try again in a moment.');
      });
    return () => { cancelled = true; };
  }, [latitude, longitude, query]);

  if (!point) {
    return <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{status || 'No map location yet.'}</p>;
  }
  const pad = 0.012;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${point.longitude - pad}%2C${point.latitude - pad}%2C${point.longitude + pad}%2C${point.latitude + pad}&layer=mapnik&marker=${point.latitude}%2C${point.longitude}`;
  return (
    <iframe
      title="Property location"
      src={src}
      style={{ width: '100%', height, border: 0, borderRadius: 12, background: '#e8eef4' }}
    />
  );
}
