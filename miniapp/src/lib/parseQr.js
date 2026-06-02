function decodeTgDeepParam(param) {
  if (param.startsWith('gh_'))    return { token: param.slice(3), promo: false, geohunt: true };
  if (param.startsWith('promo_')) return { token: param,          promo: true,  geohunt: false };
  return { token: param, promo: false, geohunt: false };
}

export function parseScanResult(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);

    // Legacy webapp URL: /checkin?token=TOKEN[&promo=1][&geohunt=1]
    const t = url.searchParams.get('token');
    if (t) {
      return {
        token:   t,
        promo:   url.searchParams.get('promo')   === '1',
        geohunt: url.searchParams.get('geohunt') === '1',
      };
    }

    // t.me deep link: t.me/Bot?start=TOKEN  or  t.me/Bot/App?startapp=TOKEN
    if (url.hostname === 't.me') {
      const deepParam = url.searchParams.get('startapp') || url.searchParams.get('start');
      if (deepParam) return decodeTgDeepParam(deepParam);
    }
  } catch { /* not a URL */ }

  // Raw token (alphanumeric)
  if (/^[A-Za-z0-9_\-]{8,60}$/.test(raw.trim())) {
    return { token: raw.trim(), promo: false, geohunt: false };
  }
  return null;
}
