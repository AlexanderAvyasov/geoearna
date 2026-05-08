import { useEffect, useState } from 'react';

export function useLocation() {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Геолокация не поддерживается в этом браузере.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLoading(false);
      },
      (positionError) => {
        if (positionError.code === positionError.PERMISSION_DENIED) {
          setError('Разрешите доступ к геолокации, чтобы проверить чекин.');
        } else {
          setError('Не удалось определить местоположение. Попробуйте еще раз.');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );
  }, []);

  return { lat, lng, error, loading };
}
