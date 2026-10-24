'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export function OverviewAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    const visible = () => { if (!document.hidden) router.refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [router]);
  return null;
}
