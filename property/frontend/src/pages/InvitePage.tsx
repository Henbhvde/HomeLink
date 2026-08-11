import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { acceptInviteApi, loginApi, registerApi, setAccessToken } from '../services/authApi';

export default function InvitePage() {
  const [params] = useSearchParams();
  const inviteToken = params.get('token') ?? '';
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptingRef = useRef(false);

  const accept = async () => {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    try {
    if (!inviteToken) throw new Error('Урилгын холбоос буруу байна.');
    const session = await acceptInviteApi(inviteToken);
    login(session.user, session.token);
    navigate(session.user.role === 'staff' ? '/staff' : session.user.role === 'resident' ? '/resident' : '/', { replace: true });
    } finally {
      acceptingRef.current = false;
    }
  };

  useEffect(() => {
    if (!user || !token || !inviteToken) return;
    setAccessToken(token);
    setLoading(true);
    void accept().catch((cause) => setError(cause instanceof Error ? cause.message : 'Урилгыг баталгаажуулж чадсангүй.')).finally(() => setLoading(false));
  }, [user?.id, token, inviteToken]);

  const submit = async () => {
    if (!email.trim() || !password || (registering && !fullName.trim())) return;
    setLoading(true);
    setError(null);
    try {
      let session;
      if (registering) {
        try {
          session = await registerApi({ email: email.trim(), password, fullName: fullName.trim(), role: 'resident', inviteToken });
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.includes('already exists')) throw cause;
          session = await loginApi(email.trim(), password);
        }
      } else {
        session = await loginApi(email.trim(), password);
      }
      setAccessToken(session.token);
      await accept();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Урилгыг баталгаажуулж чадсангүй.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-[#f3efe7] p-5 text-[#28261f] [color-scheme:light]">
    <section className="w-full max-w-md rounded-[2rem] border border-[#d8d0c1] bg-[#faf7f1] p-7 shadow-xl">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dceadf] text-[#2f654d]"><CheckCircle2 className="h-6 w-6" /></span>
      <h1 className="mt-5 font-serif text-3xl">HomeLink урилга</h1>
      <p className="mt-2 text-sm text-[#777064]">Урилга ирсэн Gmail хаягаараа {registering ? 'HomeLink бүртгэл үүсгээд шинэ нууц үг тохируулна уу. Gmail-ийн нууц үгээ бүү оруулаарай.' : 'HomeLink нууц үгээрээ нэвтэрнэ үү.'}</p>
      {!user && <div className="mt-6 space-y-4">
        {registering && <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Бүтэн нэр" />}
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Gmail хаяг" />
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Нууц үг" />
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <Button className="w-full" loading={loading} onClick={() => void submit()}>{registering ? 'Бүртгүүлээд урилга хүлээн авах' : 'Нэвтрээд урилга хүлээн авах'}</Button>
        <button type="button" className="w-full text-xs font-semibold text-[#75613f]" onClick={() => { setRegistering((value) => !value); setError(null); }}>{registering ? 'Бүртгэлтэй бол нэвтрэх' : 'Шинэ хэрэглэгч бол бүртгүүлэх'}</button>
      </div>}
      {user && <p className="mt-6 text-sm">{loading ? 'Урилгыг баталгаажуулж байна…' : error ?? 'Урилгыг шалгаж байна…'}</p>}
    </section>
  </main>;
}
