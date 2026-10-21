import { useEffect, useState } from 'react';

/** True selama media query cocok (mis. layar HP). Aman bila matchMedia tidak ada. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof matchMedia === 'function' && matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return match;
}
