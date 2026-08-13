import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Building, Mail, Lock, User, Phone, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPostLoginPath, loginApi, logoutApi, registerApi, startGoogleLogin } from '../../services/authApi';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loginKind, setLoginKind] = useState<'soh' | 'resident'>('resident');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Sync mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setSuccess(false);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
      const styles = window.getComputedStyle(element);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError('');
    navigate(nextMode === 'login' ? '/login' : '/signup');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('И-мэйл болон нууц үгээ оруулна уу.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Нууц үг хамгийн багадаа 8 тэмдэгт байна.');
        return;
      }
      if (!name || !phone) {
        setError('Бүх талбарыг бөглөнө үү.');
        return;
      }
      if (!agree) {
        setError('Үйлчилгээний нөхцөлийг зөвшөөрнө үү.');
        return;
      }
      
      setIsLoading(true);
      try {
        await registerApi({
          email,
          password,
          fullName: name,
          phone,
        });
        await logoutApi();
        setPassword('');
        setMode('login');
        navigate('/login', { replace: true });
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : 'Бүртгүүлэхэд алдаа гарлаа.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const session = await loginApi(email, password);
      const loginRole = session.user.role;
      const isSohUser = ['manager', 'accountant', 'staff'].includes(loginRole);
      if (loginKind === 'soh' && loginRole === 'resident') {
        setError('Энэ бүртгэл оршин суугчийн бүртгэл байна.');
        return;
      }
      if (loginKind === 'resident' && isSohUser) {
        setError('Энэ бүртгэл СӨХ-ийн бүртгэл байна.');
        return;
      }
      login(session.user, session.token);
      onClose();
      navigate(getPostLoginPath(loginRole, loginKind));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Нэвтрэхэд алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, nextMode: 'login' | 'signup') => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      switchMode(nextMode);
    }
  };

  return createPortal(
    <div className="auth-modal-root fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Нэвтрэх эсвэл бүртгүүлэх">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div ref={dialogRef} tabIndex={-1} className="auth-modal-panel relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-sand/20 bg-[#0e0d0c] p-7 shadow-2xl transition-all duration-300 transform scale-100 z-10">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-7 w-7 items-center justify-center text-sand">
            <Building className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <b className="block text-xs font-serif font-semibold text-cream">HomeLink</b>
            <span className="block text-[7px] text-sand-400 font-sans tracking-[0.2em] uppercase">MANAGEMENT</span>
          </div>
        </div>

        {/* Tab Headers with Close Button */}
        <div className="flex items-center justify-between mb-6">
          <div role="tablist" aria-label="Нэвтрэх сонголт" className="flex-1 grid grid-cols-2 border-b border-white/5 text-xs uppercase tracking-wider font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              onKeyDown={(event) => handleModeKeyDown(event, 'signup')}
              role="tab"
              aria-selected={mode === 'login'}
              tabIndex={mode === 'login' ? 0 : -1}
              className={`pb-3 text-center transition-all ${mode === 'login' ? 'border-b border-sand text-cream font-bold' : 'text-sand-400 hover:text-cream'}`}
            >
              Нэвтрэх
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              onKeyDown={(event) => handleModeKeyDown(event, 'login')}
              role="tab"
              aria-selected={mode === 'signup'}
              tabIndex={mode === 'signup' ? 0 : -1}
              className={`pb-3 text-center transition-all ${mode === 'signup' ? 'border-b border-sand text-cream font-bold' : 'text-sand-400 hover:text-cream'}`}
            >
              Бүртгүүлэх
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Цонх хаах"
            className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sand-400 transition-all duration-200 hover:bg-white/10 hover:text-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-sand/15 border border-sand text-sand flex items-center justify-center mb-4">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg text-cream font-semibold">Бүртгэл амжилттай</h3>
            <p className="text-sand-400 text-xs mt-2">Хяналтын самбар руу шилжиж байна...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {error && (
              <div role="alert" className="p-3 text-xs rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
                {error}
              </div>
            )}

            {mode === 'login' && (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/10 p-1.5">
                <button type="button" onClick={() => setLoginKind('soh')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${loginKind === 'soh' ? 'bg-sand text-onyx' : 'text-sand-400 hover:bg-white/5 hover:text-cream'}`}>
                  <Building className="h-4 w-4" />СӨХ
                </button>
                <button type="button" onClick={() => setLoginKind('resident')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${loginKind === 'resident' ? 'bg-sand text-onyx' : 'text-sand-400 hover:bg-white/5 hover:text-cream'}`}>
                  <User className="h-4 w-4" />Оршин суугч
                </button>
              </div>
            )}

            {/* Form Fields */}
            {mode === 'signup' && (
              <>
                {/* Full name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Бүтэн нэр</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-sand-400" />
                    <input 
                      type="text" 
                      placeholder="Овог Нэр"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-[#121211]/50 border border-white/5 focus:border-sand focus:ring-0 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-cream transition-colors placeholder:text-sand-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Утасны дугаар</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-sand-400" />
                    <input 
                      type="tel" 
                      placeholder="Утас"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-[#121211]/50 border border-white/5 focus:border-sand focus:ring-0 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-cream transition-colors placeholder:text-sand-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">И-мэйл хаяг</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-sand-400" />
                <input 
                  type="email"
                  name="homelink-role-email"
                  autoComplete="off"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#121211]/50 border border-white/5 focus:border-sand focus:ring-0 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-cream transition-colors placeholder:text-sand-500"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">Нууц үг</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-sand-400" />
                <input 
                  type="password"
                  minLength={8}
                  name="homelink-role-password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#121211]/50 border border-white/5 focus:border-sand focus:ring-0 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-cream transition-colors placeholder:text-sand-500"
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={() => { navigate('/forgot-password'); onClose(); }}
                  className="text-[10px] text-sand hover:text-cream transition-colors"
                >
                  Нууц үг мартсан?
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex items-start gap-2.5 pt-1">
                <input 
                  type="checkbox" 
                  id="agree"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  className="w-3.5 h-3.5 accent-sand rounded border-white/10 bg-[#121211] mt-0.5" 
                />
                <label htmlFor="agree" className="text-[10px] text-sand-400 leading-tight">
                  Би <span className="text-sand underline cursor-pointer">Үйлчилгээний нөхцөл</span> болон <span className="text-sand underline cursor-pointer">Нууцлалын бодлогыг</span> зөвшөөрч байна.
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3 bg-sand hover:bg-cream text-onyx font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-lg shadow-sand/10"
            >
              {isLoading ? 'Түр хүлээнэ үү...' : mode === 'login' ? 'Нэвтрэх' : 'Үүсгэх'}
            </button>

            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.16em] text-sand-500">
              <span className="h-px flex-1 bg-white/10" /> эсвэл <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => startGoogleLogin(mode === 'login' ? loginKind : 'resident')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-bold text-cream transition hover:border-sand/40 hover:bg-sand/10"
            >
              Google эрхээр нэвтрэх
            </button>

            {/* Form Toggle Link */}
            <div className="text-center pt-2">
              <span className="text-[10px] text-sand-400">
                {mode === 'login' ? (
                  <>
                    Шинэ хэрэглэгч үү?{' '}
                    <button 
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="text-sand underline hover:text-cream transition-colors"
                    >
                      Бүртгүүлэх
                    </button>
                  </>
                ) : (
                  <>
                    Бүртгэлтэй юу?{' '}
                    <button 
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-sand underline hover:text-cream transition-colors"
                    >
                      Нэвтрэх
                    </button>
                  </>
                )}
              </span>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
