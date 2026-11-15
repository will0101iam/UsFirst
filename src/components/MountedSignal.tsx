import { useEffect } from 'react';
export default function MountedSignal() {
  useEffect(() => { window.dispatchEvent(new Event('usfirst:mounted')); }, []);
  return null;
}
