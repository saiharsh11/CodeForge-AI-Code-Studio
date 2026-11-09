import { lazy, Suspense } from 'react';
import Landing from '@/landing/Landing';

// The studio is code-split so the landing page stays light.
const Studio = lazy(() => import('@/studio/Studio'));

export default function App() {
  const isStudio = window.location.pathname.replace(/\/+$/, '') === '/app';
  if (!isStudio) return <Landing />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f8f5]" />}>
      <Studio />
    </Suspense>
  );
}
