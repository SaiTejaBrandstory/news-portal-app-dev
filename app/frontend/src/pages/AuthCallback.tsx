import { useEffect } from 'react';
import { useSeoHead } from '@/hooks/useSeoHead';

export default function AuthCallback() {
  useSeoHead({ noIndex: true });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Store the JWT the same way the SDK reads it — localStorage key 'token'
      localStorage.setItem('token', token);

      // Redirect back into the app. BASE_URL is '/news/' in prod, '/' in dev.
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      window.location.replace(`${base}/admin`);
    } else {
      // No token — something went wrong, go back to the portal home
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      window.location.replace(base || '/');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you in…</p>
      </div>
    </div>
  );
}
