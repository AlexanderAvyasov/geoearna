import { useEffect, useState } from 'react';
import { getGeoPos } from '../lib/geoPos';

export function useLocation() {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGeoPos()
      .then(pos => { setLat(pos.lat); setLng(pos.lng); })
      .catch(err => {
        if (err.code === 1 || err.message === 'PERMISSION_DENIED') {
          setError('denied');
        } else if (err.message === 'UNSUPPORTED') {
          setError('Геолокация не поддерживается в этом браузере.');
        } else {
          setError('Не удалось определить местоположение. Попробуйте ещё раз.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { lat, lng, error, loading };
}
