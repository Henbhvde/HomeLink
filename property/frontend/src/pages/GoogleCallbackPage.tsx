import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGoogleRedirectUri, googleLoginApi, startGoogleLogin } from '../services/authApi';

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [message, setMessage] = useState('Google эрхээр нэвтэрч байна...');
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');
    if (oauthError || !code || !state) {
      setMessage('Google нэвтрэлт цуцлагдсан эсвэл code ирсэнгүй.');
      return;
    }

    googleLoginApi(code, state, getGoogleRedirectUri())
      .then((session) => {
        window.sessionStorage.removeItem('homelink-google-oauth-retry');
        login(session.user, session.token);
        const role = session.user.role;
        navigate(role === 'unassigned' ? '/resident/join' : role === 'super_admin' ? '/platform' : role === 'accountant' ? '/accountant' : role === 'staff' ? '/staff' : role === 'resident' ? '/resident' : '/manager', { replace: true });
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : 'Google нэвтрэлт амжилтгүй боллоо.';
        if (text.toLowerCase().includes('oauth state') && !window.sessionStorage.getItem('homelink-google-oauth-retry')) {
          window.sessionStorage.setItem('homelink-google-oauth-retry', '1');
          startGoogleLogin();
          return;
        }
        window.sessionStorage.removeItem('homelink-google-oauth-retry');
        setMessage(text);
      });
  }, [login, navigate, params]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3eee6] p-6 text-center text-[#20251f]">
      <div className="rounded-3xl border border-black/10 bg-white/60 p-8 shadow-xl">
        <p className="text-sm font-semibold">{message}</p>
      </div>
    </main>
  );
}
