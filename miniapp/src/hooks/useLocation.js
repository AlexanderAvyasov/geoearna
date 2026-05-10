import { useCallback, useEffect, useRef, useState } from 'react';
import { clearGeoCache, getGeoPos } from '../lib/geoPos';

export function useLocation() {
  const [lat,     setLat]     = useState(null);
  const [lng,     setLng]     = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);
  // 'denied_hard' = OS-level denial after user already tried the dialog
  const deniedCount = useRef(0);

  function fetchGeo(force = false) {
    setLoading(true);
    setError('');
    if (force) clearGeoCache();

    getGeoPos({ forceRefresh: force })
      .then(pos => {
        deniedCount.current = 0;
        setLat(pos.lat);
        setLng(pos.lng);
      })
      .catch(err => {
        if (err.code === 1) {
          deniedCount.current += 1;
          // First denial: may still be fixable by calling getCurrentPosition again
          // (some browsers/Telegram allow re-requesting after first dismiss)
          setError(deniedCount.current >= 2 ? 'denied_hard' : 'denied');
        } else if (err.message === 'UNSUPPORTED') {
          setError('Геолокация не поддерживается в этом браузере.');
        } else {
          setError('Не удалось определить местоположение. Попробуйте ещё раз.');
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchGeo(false); }, []);

  // Calling retry() directly invokes getCurrentPosition again — shows the OS dialog
  const retry = useCallback(() => fetchGeo(true), []);

  return { lat, lng, error, loading, retry };
}
