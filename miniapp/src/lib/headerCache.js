let _cache = null;
export const headerCache = {
  get:   ()  => _cache,
  set:   (v) => { _cache = v; },
  reset: ()  => { _cache = null; },
};
