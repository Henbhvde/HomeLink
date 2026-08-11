import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Check, ChevronLeft, KeyRound, Mail, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { forgotPasswordApi, loginApi, registerApi, resetPasswordApi, startGoogleLogin, verifyOtpApi } from '../services/authApi';
import type { UserRole } from '../types/auth';
import { validateLoginForm, validateRecoveryForm, validateRegisterForm, validateResetPasswordForm, validateOtpCode } from '../utils/authValidation';

export type AuthScreen = 'login' | 'register' | 'forgot-password' | 'verify-otp' | 'reset-password' | 'onboarding';

type AuthPageProps = {
  screen: AuthScreen;
};

type OnboardingFormState = {
  propertyName: string;
  address: string;
  buildingName: string;
  entranceCount: string;
  unitCount: string;
  serviceFee: string;
  waterRate: string;
  dueDay: string;
};

const screenCopy: Record<AuthScreen, { eyebrow: string; title: string; description: string }> = {
  login: { eyebrow: 'WELCOME BACK', title: 'Тавтай морил.', description: 'Удирдлагын самбартаа аюулгүй нэвтэрнэ үү.' },
  register: { eyebrow: 'CREATE YOUR WORKSPACE', title: 'Шинэ эхлэл.', description: 'Хотхоныхоо ухаалаг удирдлагыг хэдхэн алхмаар эхлүүлээрэй.' },
  'forgot-password': { eyebrow: 'PASSWORD RECOVERY', title: 'Нууц үгээ сэргээх.', description: 'Бүртгэлтэй и-мэйл хаягаа оруулна уу.' },
  'verify-otp': { eyebrow: 'SECURITY CHECK', title: 'Кодоо баталгаажуулна уу.', description: 'Таны и-мэйл рүү илгээсэн 6 оронтой кодыг оруулна уу.' },
  'reset-password': { eyebrow: 'NEW PASSWORD', title: 'Шинэ нууц үг.', description: 'Аюулгүй, давтагдаагүй нууц үг сонгоорой.' },
  onboarding: { eyebrow: 'SETUP YOUR WORKSPACE', title: 'Танай хотхонтой танилцъя.', description: 'Энэ мэдээлэл таны workspace-г анхны байдлаар бэлдэнэ.' },
};

export default function AuthPage({ screen }: AuthPageProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingForm, setOnboardingForm] = useState<OnboardingFormState>({
    propertyName: '',
    address: '',
    buildingName: '',
    entranceCount: '2',
    unitCount: '80',
    serviceFee: '85000',
    waterRate: '1800',
    dueDay: '25',
  });
  const [onboardingErrors, setOnboardingErrors] = useState<Record<string, string>>({});
  const [recoveryEmail, setRecoveryEmail] = useState(() => window.sessionStorage.getItem('homelink-reset-email') ?? '');
  const [resetToken, setResetToken] = useState(() => window.sessionStorage.getItem('homelink-reset-token') ?? '');
  const [demoResetCode, setDemoResetCode] = useState(() => import.meta.env.DEV ? window.sessionStorage.getItem('homelink-reset-demo-code') ?? '' : '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '' });
  const [registerErrors, setRegisterErrors] = useState({ name: '', email: '', workspaceName: '', password: '' });
  const [recoveryError, setRecoveryError] = useState('');
  const [resetErrors, setResetErrors] = useState({ password: '', confirmPassword: '' });
  const [otpError, setOtpError] = useState('');
  const copy = screenCopy[screen];

  useEffect(() => {
    if (screen === 'verify-otp' && !recoveryEmail) navigate('/forgot-password', { replace: true });
    if (screen === 'reset-password' && !resetToken) navigate('/forgot-password', { replace: true });
    if (screen === 'onboarding' && !onboardingForm.propertyName && workspaceName) {
      setOnboardingForm((current) => ({ ...current, propertyName: workspaceName }));
    }
  }, [navigate, onboardingForm.propertyName, recoveryEmail, resetToken, screen, workspaceName]);

  const completeLogin = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateLoginForm(loginEmail, loginPassword);
    setLoginErrors(validation.errors);
    if (!validation.isValid) {
      setError('Нэвтрэхийн өмнө мэдээллээ шалгана уу.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const session = await loginApi(loginEmail, loginPassword);
      const routeByRole: Record<UserRole, string> = {
        unassigned: '/resident/join',
        super_admin: '/platform',
        manager: '/manager',
        accountant: '/accountant',
        staff: '/staff',
        resident: '/resident',
      };
      login(session.user, session.token);
      setNotice('Амжилттай нэвтэрлээ. Танай самбар руу шилжиж байна...');
      navigate(routeByRole[session.user.role]);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Нэвтрэхэд алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateRegisterForm(registerName, registerEmail, workspaceName, registerPassword);
    setRegisterErrors(validation.errors);
    if (!validation.isValid) {
      setError('Бүртгүүлэхийн өмнө мэдээллээ шалгана уу.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const session = await registerApi({
        email: registerEmail,
        password: registerPassword,
        fullName: registerName,
        role: 'resident',
        workspaceName,
      });
      login(session.user, session.token);
      setNotice('Бүртгэл амжилттай үүслээ. СӨХ-д нэгдэх хүсэлтийн хуудас руу шилжиж байна...');
      navigate('/resident/join');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Бүртгүүлэхэд алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateOnboardingStep = (step: number) => {
    const nextErrors: Record<string, string> = {};
    if (step === 1) {
      if (!onboardingForm.propertyName.trim()) nextErrors.propertyName = 'СӨХ-ийн нэрийг оруулна уу.';
      if (!onboardingForm.address.trim()) nextErrors.address = 'Байршлыг оруулна уу.';
    }
    if (step === 2) {
      if (!onboardingForm.buildingName.trim()) nextErrors.buildingName = 'Байр / барилгын нэрийг оруулна уу.';
      if (!onboardingForm.entranceCount.trim()) nextErrors.entranceCount = 'Орцын тоог оруулна уу.';
    }
    if (step === 3) {
      if (!onboardingForm.unitCount.trim()) nextErrors.unitCount = 'Айлын тоог оруулна уу.';
    }
    if (step === 4) {
      if (!onboardingForm.serviceFee.trim()) nextErrors.serviceFee = 'СӨХ-ийн үйлчилгээний хураамж оруулна уу.';
      if (!onboardingForm.waterRate.trim()) nextErrors.waterRate = 'Усны тариф оруулна уу.';
      if (!onboardingForm.dueDay.trim()) nextErrors.dueDay = 'Төлбөрийн эцсийн өдөр оруулна уу.';
    }

    setOnboardingErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goToNextOnboardingStep = () => {
    if (!validateOnboardingStep(onboardingStep)) return;
    setOnboardingStep((current) => Math.min(4, current + 1));
  };

  const goToPreviousOnboardingStep = () => {
    setOnboardingStep((current) => Math.max(1, current - 1));
    setOnboardingErrors({});
  };

  const completeOnboarding = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateOnboardingStep(onboardingStep)) return;

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      window.sessionStorage.setItem('homelink-onboarding', JSON.stringify(onboardingForm));
      setNotice('Workspace бэлэн боллоо. Менежерийн самбар руу шилжиж байна...');
      window.setTimeout(() => {
        navigate('/manager');
      }, 600);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateRecoveryForm(recoveryEmail);
    setRecoveryError(validation.error);
    if (!validation.isValid) {
      setError('И-мэйл хаягаа шалгаад дахин оролдоно уу.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await forgotPasswordApi(recoveryEmail);
      window.sessionStorage.setItem('homelink-reset-email', result.email);
      if (import.meta.env.DEV && result.resetCode) {
        window.sessionStorage.setItem('homelink-reset-demo-code', result.resetCode);
        setDemoResetCode(result.resetCode);
      } else {
        window.sessionStorage.removeItem('homelink-reset-demo-code');
        setDemoResetCode('');
      }
      setRecoveryEmail(result.email);
      setNotice(`Код илгээгдлээ. ${result.expiresInMinutes} минутын дотор баталгаажуулна уу.`);
      navigate('/verify-otp');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Код илгээхэд алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyResetOtp = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateOtpCode(otp);
    setOtpError(validation.error);
    if (!validation.isValid) {
      setError('6 оронтой код оруулна уу.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const email = recoveryEmail || window.sessionStorage.getItem('homelink-reset-email') || '';
      const code = otp.join('');
      const result = await verifyOtpApi(email, code);
      window.sessionStorage.setItem('homelink-reset-token', result.resetToken);
      setResetToken(result.resetToken);
      setNotice('Код амжилттай баталгаажлаа. Шинэ нууц үг оруулна уу.');
      navigate('/reset-password');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'OTP баталгаажуулахад алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const completePasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateResetPasswordForm(newPassword, confirmPassword);
    setResetErrors(validation.errors);
    if (!validation.isValid) {
      setError('Шинэ нууц үгээ шалгаад дахин оролдоно уу.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const token = resetToken || window.sessionStorage.getItem('homelink-reset-token') || '';
      await resetPasswordApi(token, newPassword);
      window.sessionStorage.removeItem('homelink-reset-email');
      window.sessionStorage.removeItem('homelink-reset-token');
      window.sessionStorage.removeItem('homelink-reset-demo-code');
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.');
      navigate('/login');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Нууц үг солиход алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090909] text-cream lg:grid lg:grid-cols-[.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden border-r border-white/5 bg-[#11100e] p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(197,168,128,.2),transparent_30%),radial-gradient(circle_at_85%_75%,rgba(197,168,128,.1),transparent_35%)]" />
        <Link to="/" className="relative z-10 flex items-center gap-3 self-start">
          <span className="grid h-10 w-10 place-items-center text-sand"><Building2 className="h-6 w-6" strokeWidth={1.75} /></span>
          <span><b className="block font-serif text-lg">HomeLink</b><small className="block text-[9px] font-bold tracking-[.2em] text-sand-400">MANAGEMENT</small></span>
        </Link>
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-sand/20 bg-sand/5 px-3 py-1 text-[10px] font-bold tracking-widest text-sand"><Sparkles className="h-3 w-3" /> SMART PROPERTY</span>
          <h1 className="mt-6 font-serif text-5xl font-light leading-[1.04]">Таны хотхоны<br /><i className="text-sand">нэг цэгийн</i> удирдлага.</h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-sand-300">Төлбөр, засвар, зарлал болон оршин суугчдын харилцааг илүү ойлгомжтой болгоорой.</p>
          <div className="mt-10 space-y-4">
            {['Бүх багийн бодит цагийн хандалт', 'Оршин суугчдад зориулсан тусдаа портал', 'Ил тод тайлан ба аюулгүй бүртгэл'].map((item) => <p key={item} className="flex items-center gap-3 text-xs text-sand-200"><span className="grid h-5 w-5 place-items-center rounded-full bg-sand/15 text-sand"><Check className="h-3 w-3" /></span>{item}</p>)}
          </div>
        </div>
        <p className="relative z-10 text-xs text-sand-500">© 2026 HomeLink Management</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="relative w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden"><Link to="/" className="flex items-center gap-2 font-serif text-xl"><Building2 className="h-5 w-5 text-sand" />HomeLink</Link><Link to="/" className="text-xs text-sand-400">Нүүр хуудас</Link></div>
          {screen !== 'login' && <button onClick={() => navigate(screen === 'onboarding' ? '/register' : '/login')} className="mb-7 inline-flex items-center gap-1 text-xs text-sand-400 hover:text-cream"><ChevronLeft className="h-4 w-4" />Буцах</button>}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-[.22em] text-sand">{copy.eyebrow}</span>
              <h2 className="mt-3 font-serif text-4xl font-light text-cream">{copy.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sand-400 transition-all duration-200 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-sand-400">{copy.description}</p>
          {notice && <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</p>}

          {screen === 'login' && <form className="mt-8 space-y-4" onSubmit={completeLogin} autoComplete="off">
            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <label className="block text-xs font-semibold text-sand-200">И-мэйл хаяг<Input required type="email" name="homelink-role-email" autoComplete="off" value={loginEmail} onChange={(event) => { setLoginEmail(event.target.value); if (loginErrors.email) setLoginErrors((current) => ({ ...current, email: '' })); }} className={`mt-2 ${loginErrors.email ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="name@company.mn" /></label>
            {loginErrors.email && <p className="-mt-2 text-xs text-red-300">{loginErrors.email}</p>}
            <label className="block text-xs font-semibold text-sand-200">Нууц үг<Input required type="password" name="homelink-role-password" autoComplete="current-password" value={loginPassword} onChange={(event) => { setLoginPassword(event.target.value); if (loginErrors.password) setLoginErrors((current) => ({ ...current, password: '' })); }} className={`mt-2 ${loginErrors.password ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="••••••••" /></label>
            {loginErrors.password && <p className="-mt-2 text-xs text-red-300">{loginErrors.password}</p>}
            <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-sand hover:text-cream">Нууц үг мартсан?</Link></div>
            <Button loading={isLoading} type="submit" className="w-full" disabled={!loginEmail.trim() || !loginPassword.trim()}>Нэвтрэх <ArrowRight className="h-4 w-4" /></Button>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.16em] text-sand-500"><span className="h-px flex-1 bg-white/10" />эсвэл<span className="h-px flex-1 bg-white/10" /></div>
            <button type="button" onClick={startGoogleLogin} className="w-full rounded-xl border border-sand/25 px-4 py-3 text-xs font-bold text-sand transition hover:bg-sand/10">Google эрхээр нэвтрэх</button>
            <p className="pt-2 text-center text-xs text-sand-400">Бүртгэлгүй юу? <Link to="/register" className="font-semibold text-sand hover:text-cream">Үнэгүй эхлэх</Link></p>
          </form>}

          {screen === 'register' && <form className="mt-8 space-y-4" onSubmit={completeRegistration}>
            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <button type="button" onClick={startGoogleLogin} className="w-full rounded-xl border border-sand/25 px-4 py-3 text-xs font-bold text-sand transition hover:bg-sand/10">Google эрхээр эхлэх</button>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.16em] text-sand-500"><span className="h-px flex-1 bg-white/10" />эсвэл<span className="h-px flex-1 bg-white/10" /></div>
            <label className="block text-xs font-semibold text-sand-200">Таны нэр<Input required value={registerName} onChange={(event) => { setRegisterName(event.target.value); if (registerErrors.name) setRegisterErrors((current) => ({ ...current, name: '' })); }} className={`mt-2 ${registerErrors.name ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="Бат-Эрдэнэ" /></label>
            {registerErrors.name && <p className="-mt-2 text-xs text-red-300">{registerErrors.name}</p>}
            <label className="block text-xs font-semibold text-sand-200">Ажлын и-мэйл<Input required type="email" value={registerEmail} onChange={(event) => { setRegisterEmail(event.target.value); if (registerErrors.email) setRegisterErrors((current) => ({ ...current, email: '' })); }} className={`mt-2 ${registerErrors.email ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="name@company.mn" /></label>
            {registerErrors.email && <p className="-mt-2 text-xs text-red-300">{registerErrors.email}</p>}
            <label className="block text-xs font-semibold text-sand-200">Хотхон / СӨХ-ийн нэр<Input required value={workspaceName} onChange={(event) => { setWorkspaceName(event.target.value); if (registerErrors.workspaceName) setRegisterErrors((current) => ({ ...current, workspaceName: '' })); }} className={`mt-2 ${registerErrors.workspaceName ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="Evergreen Residence" /></label>
            {registerErrors.workspaceName && <p className="-mt-2 text-xs text-red-300">{registerErrors.workspaceName}</p>}
            <label className="block text-xs font-semibold text-sand-200">Нууц үг<Input required minLength={8} type="password" autoComplete="new-password" value={registerPassword} onChange={(event) => { setRegisterPassword(event.target.value); if (registerErrors.password) setRegisterErrors((current) => ({ ...current, password: '' })); }} className={`mt-2 ${registerErrors.password ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="8-аас доошгүй тэмдэгт" /></label>
            {registerErrors.password && <p className="-mt-2 text-xs text-red-300">{registerErrors.password}</p>}
            <Button loading={isLoading} type="submit" className="mt-2 w-full" disabled={!registerName.trim() || !registerEmail.trim() || !workspaceName.trim() || registerPassword.length < 8}>Ажлын орчин үүсгэх <ArrowRight className="h-4 w-4" /></Button>
            <p className="text-center text-xs text-sand-400">Аль хэдийн бүртгэлтэй юу? <Link to="/login" className="font-semibold text-sand hover:text-cream">Нэвтрэх</Link></p>
          </form>}

          {screen === 'forgot-password' && <form className="mt-8 space-y-5" onSubmit={requestPasswordReset}>
            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <label className="block text-xs font-semibold text-sand-200">И-мэйл хаяг<Input required type="email" value={recoveryEmail} onChange={(event) => { setRecoveryEmail(event.target.value); setRecoveryError(''); }} className={`mt-2 ${recoveryError ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="name@company.mn" /></label>
            {recoveryError && <p className="-mt-2 text-xs text-red-300">{recoveryError}</p>}
            <Button loading={isLoading} type="submit" className="w-full" disabled={!recoveryEmail.trim()}><Mail className="h-4 w-4" />Код илгээх</Button>
          </form>}

          {screen === 'verify-otp' && <form className="mt-8" onSubmit={verifyResetOtp}>
            {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            {otpError && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{otpError}</p>}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-sand-300">Email: {recoveryEmail || 'эхлээд email оруулна уу'}</div>
            {import.meta.env.DEV && demoResetCode && <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">Demo OTP: {demoResetCode}</div>}
            <div className="flex justify-between gap-2">{otp.map((value, index) => <input key={index} value={value} maxLength={1} inputMode="numeric" onChange={(event) => { const nextValue = event.target.value.replace(/\D/g, ''); setOtp((current) => current.map((item, itemIndex) => itemIndex === index ? nextValue : item)); if (otpError) setOtpError(''); }} className="h-12 w-full rounded-xl border border-white/10 bg-black/20 text-center text-lg font-semibold text-cream outline-none focus:border-sand" />)}</div>
            <Button loading={isLoading} disabled={otp.join('').length !== 6 || !recoveryEmail} type="submit" className="mt-6 w-full"><ShieldCheck className="h-4 w-4" />Баталгаажуулах</Button>
          </form>}

          {screen === 'reset-password' && <form className="mt-8 space-y-4" onSubmit={completePasswordReset}>
            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <label className="block text-xs font-semibold text-sand-200">Шинэ нууц үг<Input required minLength={8} type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); if (resetErrors.password) setResetErrors((current) => ({ ...current, password: '' })); }} className={`mt-2 ${resetErrors.password ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="••••••••" /></label>
            {resetErrors.password && <p className="-mt-2 text-xs text-red-300">{resetErrors.password}</p>}
            <label className="block text-xs font-semibold text-sand-200">Нууц үг давтах<Input required minLength={8} type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); if (resetErrors.confirmPassword) setResetErrors((current) => ({ ...current, confirmPassword: '' })); }} className={`mt-2 ${resetErrors.confirmPassword ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="••••••••" /></label>
            {resetErrors.confirmPassword && <p className="-mt-2 text-xs text-red-300">{resetErrors.confirmPassword}</p>}
            <Button loading={isLoading} type="submit" className="w-full" disabled={!newPassword.trim() || !confirmPassword.trim()}><KeyRound className="h-4 w-4" />Нууц үг хадгалах</Button>
          </form>}

          {screen === 'onboarding' && <form className="mt-8 space-y-5" onSubmit={completeOnboarding}>
            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className={`flex-1 rounded-full px-2 py-1 text-center text-[10px] font-semibold ${onboardingStep === step ? 'bg-sand text-onyx' : 'text-sand-400'}`}>
                  {step === 1 ? 'СӨХ' : step === 2 ? 'Барилга' : step === 3 ? 'Айл' : 'Тариф'}
                </div>
              ))}
            </div>

            {onboardingStep === 1 && <div className="space-y-4">
              <label className="block text-xs font-semibold text-sand-200">СӨХ / хотхоны нэр<Input value={onboardingForm.propertyName} onChange={(event) => { setOnboardingForm((current) => ({ ...current, propertyName: event.target.value })); if (onboardingErrors.propertyName) setOnboardingErrors((current) => ({ ...current, propertyName: '' })); }} className={`mt-2 ${onboardingErrors.propertyName ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="Evergreen Residence" /></label>
              {onboardingErrors.propertyName && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.propertyName}</p>}
              <label className="block text-xs font-semibold text-sand-200">Байршил<Input value={onboardingForm.address} onChange={(event) => { setOnboardingForm((current) => ({ ...current, address: event.target.value })); if (onboardingErrors.address) setOnboardingErrors((current) => ({ ...current, address: '' })); }} className={`mt-2 ${onboardingErrors.address ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="Улаанбаатар хот" /></label>
              {onboardingErrors.address && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.address}</p>}
            </div>}

            {onboardingStep === 2 && <div className="space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Барилга / байрны нэр<Input value={onboardingForm.buildingName} onChange={(event) => { setOnboardingForm((current) => ({ ...current, buildingName: event.target.value })); if (onboardingErrors.buildingName) setOnboardingErrors((current) => ({ ...current, buildingName: '' })); }} className={`mt-2 ${onboardingErrors.buildingName ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="A байр" /></label>
              {onboardingErrors.buildingName && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.buildingName}</p>}
              <label className="block text-xs font-semibold text-sand-200">Орцын тоо<Input value={onboardingForm.entranceCount} type="number" min="1" onChange={(event) => { setOnboardingForm((current) => ({ ...current, entranceCount: event.target.value })); if (onboardingErrors.entranceCount) setOnboardingErrors((current) => ({ ...current, entranceCount: '' })); }} className={`mt-2 ${onboardingErrors.entranceCount ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="2" /></label>
              {onboardingErrors.entranceCount && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.entranceCount}</p>}
            </div>}

            {onboardingStep === 3 && <div className="space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Нийт айлын тоо<Input value={onboardingForm.unitCount} type="number" min="1" onChange={(event) => { setOnboardingForm((current) => ({ ...current, unitCount: event.target.value })); if (onboardingErrors.unitCount) setOnboardingErrors((current) => ({ ...current, unitCount: '' })); }} className={`mt-2 ${onboardingErrors.unitCount ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="80" /></label>
              {onboardingErrors.unitCount && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.unitCount}</p>}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-sand-300">
                <div className="flex items-center gap-2 font-semibold text-sand-100"><Users className="h-4 w-4 text-sand" /> Айлуудад автоматаар A-101, A-102 зэрэг дугаар олгогдоно.</div>
              </div>
            </div>}

            {onboardingStep === 4 && <div className="space-y-4">
              <label className="block text-xs font-semibold text-sand-200">СӨХ үйлчилгээний хураамж<Input value={onboardingForm.serviceFee} type="number" min="0" onChange={(event) => { setOnboardingForm((current) => ({ ...current, serviceFee: event.target.value })); if (onboardingErrors.serviceFee) setOnboardingErrors((current) => ({ ...current, serviceFee: '' })); }} className={`mt-2 ${onboardingErrors.serviceFee ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="85000" /></label>
              {onboardingErrors.serviceFee && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.serviceFee}</p>}
              <label className="block text-xs font-semibold text-sand-200">Усны тариф<Input value={onboardingForm.waterRate} type="number" min="0" onChange={(event) => { setOnboardingForm((current) => ({ ...current, waterRate: event.target.value })); if (onboardingErrors.waterRate) setOnboardingErrors((current) => ({ ...current, waterRate: '' })); }} className={`mt-2 ${onboardingErrors.waterRate ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="1800" /></label>
              {onboardingErrors.waterRate && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.waterRate}</p>}
              <label className="block text-xs font-semibold text-sand-200">Төлбөрийн эцсийн өдөр<Input value={onboardingForm.dueDay} type="number" min="1" max="31" onChange={(event) => { setOnboardingForm((current) => ({ ...current, dueDay: event.target.value })); if (onboardingErrors.dueDay) setOnboardingErrors((current) => ({ ...current, dueDay: '' })); }} className={`mt-2 ${onboardingErrors.dueDay ? 'border-red-400/60 focus:border-red-400' : ''}`} placeholder="25" /></label>
              {onboardingErrors.dueDay && <p className="-mt-2 text-xs text-red-300">{onboardingErrors.dueDay}</p>}
            </div>}

            <div className="flex items-center justify-between gap-3 pt-2">
              {onboardingStep > 1 ? <Button type="button" variant="outline" onClick={goToPreviousOnboardingStep}>Өмнөх</Button> : <div />}
              {onboardingStep < 4 ? (
                <Button type="button" onClick={goToNextOnboardingStep}>Дараах <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button loading={isLoading} type="submit" className="w-full sm:w-auto">Ажлын орчин бэлдэх <ArrowRight className="h-4 w-4" /></Button>
              )}
            </div>
          </form>}
        </div>
      </section>
    </main>
  );
}
