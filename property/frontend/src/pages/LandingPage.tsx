import { useEffect, useState } from 'react';
import {
  Home,
  Users,
  CreditCard,
  Zap,
  Wrench,
  Megaphone,
  BarChart3,
  FileText,
  Settings,
  Search,
  Bell,
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Menu,
  X,
  ArrowUpRight,
  Building,
  ChevronDown,
  Quote,
  Sun,
  Moon,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import FuzzyOverlay from '../components/ui/FuzzyOverlay';
import SpotlightCard from '../components/ui/SpotlightCard';
import TiltedCard from '../components/ui/TiltedCard';
import ShinyText from '../components/ui/ShinyText';
import BlurText from '../components/ui/BlurText';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPostLoginPath } from '../services/authApi';
import AuthModal from '../components/ui/AuthModal';
import { useTheme } from '../contexts/ThemeContext';


export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(isAuthRoute);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(location.pathname === '/signup' ? 'signup' : 'login');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    navigate(mode === 'login' ? '/login' : '/signup');
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    if (isAuthRoute) navigate('/');
  };

  useEffect(() => {
    if (!isAuthRoute) return;
    setAuthModalMode(location.pathname === '/signup' ? 'signup' : 'login');
    setIsAuthModalOpen(true);
  }, [isAuthRoute, location.pathname]);

  return (
    <div 
      className="min-h-screen font-sans text-sand-100 antialiased relative overflow-hidden bg-onyxSelection"
      style={{
        background: 'radial-gradient(circle at 80% 12%, rgba(197, 168, 128, 0.14), transparent 40%), radial-gradient(circle at 15% 40%, rgba(197, 168, 128, 0.08), transparent 30%), #090909'
      }}
    >
      {/* Film Grain Noise Overlay */}
      <FuzzyOverlay />

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes float {
          0% { transform: rotate(1deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-8px); }
          100% { transform: rotate(1deg) translateY(0); }
        }
        @keyframes floatAlert {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }
        .animate-float {
          animation: float 7s ease-in-out infinite;
        }
        .animate-float-alert-1 {
          animation: floatAlert 5.5s ease-in-out infinite;
        }
        .animate-float-alert-2 {
          animation: floatAlert 6s ease-in-out infinite 0.5s;
        }
        .animate-float-alert-3 {
          animation: floatAlert 6.5s ease-in-out infinite 1s;
        }
      `}</style>

      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-20 items-center justify-between px-6 lg:px-14">
        <a href="#home" className="flex items-center gap-3 group">
          <div className="flex h-8.5 w-8.5 items-center justify-center text-sand transition-transform group-hover:scale-[1.03]">
            <Building className="w-4.5 h-4.5" />
          </div>
          <div>
            <b className="block text-sm font-serif font-semibold tracking-wide text-cream">
              <ShinyText text="HomeLink" speed={5} />
            </b>
            <span className="block text-[8px] text-sand-400 font-sans font-bold tracking-[0.2em] uppercase">MANAGEMENT</span>
          </div>
        </a>

        {/* Header Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'}
            title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'}
            className="grid h-9 w-9 place-items-center rounded-full border border-sand/25 bg-sand/5 text-sand-200 transition hover:border-sand/60 hover:bg-sand/15"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isAuthenticated ? (
            <button 
              onClick={() => user && navigate(getPostLoginPath(user.role))}
              className="px-5 py-2 bg-sand text-onyx font-bold rounded-full text-xs transition-all flex items-center gap-1.5 shadow-md shadow-sand/15 hover:bg-cream"
            >
              Хяналтын самбар <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => openAuthModal('login')} 
                className="text-xs font-semibold text-sand-300 hover:text-cream transition-colors uppercase tracking-wider pr-1"
              >
                Нэвтрэх
              </button>
              <button 
                onClick={() => navigate('/soh/register')} 
                className="px-5 py-2 border border-sand/30 hover:border-sand bg-sand/5 hover:bg-sand/15 rounded-full text-xs font-semibold text-cream transition-all flex items-center gap-1.5"
              >
                СӨХ бүртгүүлэх <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="lg:hidden p-2 text-sand-300 hover:text-cream"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 pt-24 bg-onyx/98 backdrop-blur-xl flex flex-col p-8 gap-6 lg:hidden border-b border-white/5">
          <div className="flex flex-col gap-3 mt-6">
            {isAuthenticated ? (
              <button 
                onClick={() => { setIsMobileMenuOpen(false); if (user) navigate(getPostLoginPath(user.role)); }}
                className="w-full text-center py-3 bg-sand text-onyx font-bold rounded-full text-sm"
              >
                Хяналтын самбар
              </button>
            ) : (
              <>
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); openAuthModal('login'); }} 
                  className="w-full text-center py-3 border border-sand/30 hover:border-sand text-cream font-bold rounded-full text-sm"
                >
                  Нэвтрэх
                </button>
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); navigate('/soh/register'); }} 
                  className="w-full text-center py-3 bg-sand text-onyx font-bold rounded-full text-sm"
                >
                  СӨХ бүртгүүлэх
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-20">
        
        {/* Hero Section */}
        <section id="home" className="max-w-7xl mx-auto px-6 lg:px-14 py-5 lg:py-4 border-b border-white/5">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] items-center gap-14">
            
            {/* Hero Left Content */}
            <div className="flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sand/20 bg-sand/5 text-sand text-[9px] font-bold uppercase tracking-widest mb-6 self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-sand animate-pulse" />
                <ShinyText text="Шинэ үеийн СӨХ удирдлага" speed={6} />
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-serif font-light leading-tight text-cream mb-6 tracking-tight">
                <BlurText text="СӨХ-ийн удирдлагыг" animateBy="words" className="block" delay={100} />
                <span className="block mt-1">
                  илүү <span className="italic font-normal text-sand"><BlurText text="ухаалаг" animateBy="letters" delay={60} /></span> болго.
                </span>
              </h1>

              <p className="text-sand-300 font-sans font-light text-base sm:text-lg leading-relaxed max-w-xl mb-8">
                Нэг платформоор төлбөр тооцоо, оршин суугчийн холбоо, засвар үйлчилгээ, зарлал болон санхүүгийн ил тод байдлыг хялбар удирдаарай.
              </p>

              <div className="flex flex-wrap gap-4 mb-14">
                <button 
                  onClick={() => navigate(isAuthenticated && user ? getPostLoginPath(user.role, 'soh') : '/soh/register')}
                  className="px-6 py-3.5 bg-sand hover:bg-cream text-onyx font-bold rounded-full flex items-center gap-2 transition-all shadow-md shadow-sand/10 text-sm"
                >
                  {isAuthenticated ? 'Хяналтын самбар' : 'СӨХ бүртгүүлэх'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Hero Stats */}
              <div className="grid grid-cols-3 gap-4 max-w-lg border-t border-white/5 pt-8">
                <div className="flex flex-col">
                  <b className="h-10 text-2xl sm:text-3xl font-sans font-semibold tracking-tight leading-none text-cream block">500+</b>
                  <span className="text-[9px] text-sand-400 font-sans font-bold tracking-widest uppercase mt-1 block">СӨХ байгууллага</span>
                </div>
                <div className="flex flex-col">
                  <b className="h-10 text-2xl sm:text-3xl font-sans font-semibold tracking-tight leading-none text-cream block">25k+</b>
                  <span className="text-[9px] text-sand-400 font-sans font-bold tracking-widest uppercase mt-1 block">Оршин суугч</span>
                </div>
                <div className="flex flex-col">
                  <b className="h-10 text-2xl sm:text-3xl font-sans font-semibold tracking-tight leading-none text-cream block">98%</b>
                  <span className="text-[9px] text-sand-400 font-sans font-bold tracking-widest uppercase mt-1 block">Төлбөр цуглуулалт</span>
                </div>
              </div>
            </div>

            {/* Hero Right Visual Column (Luxury editorial styled dashboard/phone) */}
            <div className="relative w-full max-w-2xl mx-auto py-8">
              {/* Editorial device composition: desktop portal with a resident app layered in front */}
              <div className="relative z-20 h-[510px] sm:h-[550px] lg:h-[590px] overflow-visible">
                <div className="absolute inset-4 rounded-[3rem] bg-gradient-to-br from-sand/20 via-transparent to-sand/5 blur-3xl" />

                <div className="absolute left-0 top-[10%] w-[61%] overflow-hidden rounded-[1.5rem] border-[7px] border-[#d9d6ce] bg-[#171a17] shadow-[0_32px_90px_rgba(0,0,0,.6)] sm:rounded-[1.8rem] sm:border-[10px]">
                  <div className="flex h-9 items-center border-b border-white/10 bg-[#111411] px-3 text-[6px] font-semibold text-[#a99d83] sm:h-11 sm:px-4 sm:text-[7px]">
                    <span className="flex items-center gap-1.5 font-serif text-[9px] text-[#f2eee5] sm:text-xs"><i className="grid h-4 w-4 place-items-center rounded bg-[#80683f] not-italic text-white"><Building className="h-2.5 w-2.5" /></i>HomeLink</span>
                    <div className="ml-auto flex items-center rounded-lg border border-white/10 bg-white/[.025] p-0.5">
                      <span className="px-2 py-1">Нүүр</span><span className="px-2 py-1">Төлбөр</span><span className="rounded-md bg-[#80683f] px-2 py-1 text-white">Үйлчилгээ</span>
                    </div>
                  </div>
                  <div className="h-[325px] bg-[radial-gradient(circle_at_80%_15%,rgba(119,151,129,.15),transparent_38%),#191d19] p-3.5 sm:h-[380px] sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><span className="block whitespace-nowrap text-[5px] font-bold uppercase tracking-[.12em] text-[#a99065] sm:text-[6px]">A-1203 · EVERGREEN RESIDENCE</span><h3 className="mt-1 font-serif text-[14px] font-light leading-tight text-[#f2eee5] sm:text-[18px]">Үйлчилгээ, засвар</h3><p className="mt-1 max-w-[210px] text-[5px] leading-relaxed text-[#9c988e] sm:text-[6px]">Хүсэлт илгээж, шийдвэрлэлтийн явцыг хянаарай.</p></div>
                      <span className="mt-1 shrink-0 whitespace-nowrap rounded-md bg-[#80683f] px-2 py-1.5 text-[5px] font-bold text-white sm:text-[6px]">+ ХҮСЭЛТ</span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-2.5">
                      <div className="rounded-xl border border-[#9f8963]/25 bg-[#20241f] p-2.5 sm:p-3">
                        <div className="flex items-start justify-between"><i className="grid h-7 w-7 place-items-center rounded-lg bg-[#80683f]/20 not-italic text-[#c2a266]"><Wrench className="h-3.5 w-3.5" /></i><span className="rounded-full bg-[#b4873f]/15 px-2 py-1 text-[5px] font-bold text-[#c6a468] sm:text-[7px]">ХИЙГДЭЖ БУЙ</span></div>
                        <h4 className="mt-2 text-[8px] font-semibold leading-[1.3] text-[#eee9df] sm:text-[10px]">Угаалгын өрөөний ус гоожиж байна</h4>
                        <p className="mt-1 text-[5px] leading-relaxed text-[#969188] sm:text-[6px]">45 тоот · Яаралтай · Доржид оноосон</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[5px] text-[#aaa59a] sm:text-[6px]"><span className="h-1.5 w-1.5 rounded-full bg-[#71907d]" />Шинэчлэгдсэн: 14:20</div>
                      </div>
                      <div className="rounded-xl border border-[#718675]/25 bg-[#20241f] p-2.5 sm:p-3">
                        <div className="flex items-start justify-between"><i className="grid h-7 w-7 place-items-center rounded-lg bg-[#718675]/20 not-italic text-[#8fa595]"><Zap className="h-3.5 w-3.5" /></i><span className="rounded-full bg-[#718675]/15 px-2 py-1 text-[5px] font-bold text-[#8fa595] sm:text-[7px]">ДУУССАН</span></div>
                        <h4 className="mt-2 text-[8px] font-semibold leading-[1.3] text-[#eee9df] sm:text-[10px]">Орцны гэрэл асахгүй байна</h4>
                        <p className="mt-1 text-[5px] leading-relaxed text-[#969188] sm:text-[6px]">A байр · Нийтийн хэсэг · Засварласан</p>
                        <div className="mt-2 flex items-center gap-1 text-[5px] text-[#c0aa7c] sm:text-[6px]"><span>★ ★ ★ ★ ★</span><span className="text-[#8f8a81]">Үнэлгээ</span></div>
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-white/8 bg-[#20241f] px-3 py-2 sm:mt-2.5"><div className="flex items-center justify-between"><span className="text-[6px] font-semibold text-[#ddd8ce] sm:text-[8px]">Сүүлийн хүсэлтүүд</span><span className="text-[5px] text-[#a99065] sm:text-[6px]">Бүгдийг харах →</span></div><div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[5px] text-[#969188] sm:text-[6px]"><span>Нийт <b className="block text-[9px] leading-tight text-[#e8e3d9] sm:text-xs">4</b></span><span>Хийгдэж буй <b className="block text-[9px] leading-tight text-[#c2a266] sm:text-xs">1</b></span><span>Дууссан <b className="block text-[9px] leading-tight text-[#83a18d] sm:text-xs">3</b></span></div></div>
                  </div>
                </div>

                <div className="absolute right-0 top-[13%] z-10 w-[170px] rounded-[1.8rem] border-[6px] border-[#e3e0da] bg-[#e3e0da] p-1.5 shadow-[0_26px_65px_rgba(0,0,0,.65)] sm:w-[210px] sm:rounded-[2.15rem] sm:border-[8px] animate-float">
                  <div className="absolute left-1/2 top-[9px] z-10 h-3 w-16 -translate-x-1/2 rounded-full bg-[#151411] sm:top-[11px] sm:h-4 sm:w-20" />
                  <div className="h-[322px] overflow-hidden rounded-[1.3rem] bg-[#171a17] sm:h-[405px] sm:rounded-[1.6rem]">
                    <div className="flex items-center justify-between border-b border-white/8 px-3 pb-2 pt-7 sm:px-4 sm:pb-3 sm:pt-9"><span className="flex items-center gap-1.5 font-serif text-[9px] text-[#eee9df] sm:text-xs"><i className="grid h-5 w-5 place-items-center rounded-md bg-[#80683f] not-italic"><Building className="h-3 w-3" /></i>HomeLink</span><Bell className="h-3 w-3 text-[#a99268]" /></div>
                    <div className="px-3 pt-3 sm:px-4 sm:pt-4">
                      <p className="text-[6px] font-bold uppercase tracking-[.16em] text-[#a98e61] sm:text-[8px]">A-1203 · EVERGREEN</p>
                      <h3 className="mt-1 font-serif text-sm text-[#eee9df] sm:text-lg">Сайн байна уу.</h3>
                      <div className="mt-3 rounded-xl border border-[#9e865d]/25 bg-[#20241f] p-2.5 sm:mt-4 sm:p-3.5">
                        <div className="flex justify-between text-[6px] text-[#aaa59a] sm:text-[8px]"><span>Энэ сарын үлдэгдэл</span><span className="rounded-full bg-[#80683f]/20 px-1.5 py-0.5 text-[#c8aa75]">07.25</span></div>
                        <b className="mt-1.5 block text-lg text-[#f0ece3] sm:mt-2 sm:text-2xl">₮110,000</b>
                        <div className="mt-2 space-y-1 border-t border-white/8 pt-2 text-[6px] text-[#a8a399] sm:text-[7px]"><p className="flex justify-between"><span>СӨХ үйлчилгээ</span><b>₮75,600</b></p><p className="flex justify-between"><span>Усны хэрэглээ</span><b>₮20,400</b></p></div>
                        <button className="mt-2.5 w-full rounded-lg bg-[#80683f] py-1.5 text-[7px] font-bold text-white sm:mt-3 sm:rounded-xl sm:py-2 sm:text-[9px]">ТӨЛӨХ</button>
                      </div>
                      <div className="mt-2.5 rounded-xl border border-[#718675]/20 bg-[#20241f] p-2.5 sm:mt-3 sm:p-3"><div className="flex items-center justify-between"><span className="text-[7px] font-bold text-[#e5dfd4] sm:text-[9px]">Усны заалт</span><span className="text-[7px] text-[#789281]">17 м³</span></div><p className="mt-1 text-[6px] text-[#969188] sm:text-[7px]">Зурагтай заалтаа 07.24-өөс өмнө илгээнэ үү.</p></div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[6px] text-[#aaa59a] sm:mt-3 sm:gap-2 sm:text-[7px]"><span className="rounded-lg bg-white/[.05] p-2"><CreditCard className="mx-auto mb-1 h-3 w-3 text-[#b19768]" />Төлбөр</span><span className="rounded-lg bg-white/[.05] p-2"><Bell className="mx-auto mb-1 h-3 w-3 text-[#b19768]" />Мэдээ</span><span className="rounded-lg bg-white/[.05] p-2"><Wrench className="mx-auto mb-1 h-3 w-3 text-[#b19768]" />Засвар</span></div>
                    </div>
                  </div>
                </div>

                <div className="hidden absolute bottom-[2%] left-[6%] rounded-2xl border border-sand/30 bg-[#151410]/95 px-4 py-3 shadow-xl backdrop-blur-md animate-float-alert-1">
                  <p className="text-[9px] text-sand-300">Төлбөр амжилттай</p>
                  <b className="text-xs text-cream">₮110,000 хүлээн авлаа</b>
                </div>
              </div>

              {/* Radial glow background */}
              <div className="absolute -left-16 top-16 w-72 h-72 rounded-full bg-sand/10 blur-3xl -z-10" />
              <div className="absolute -right-8 bottom-16 w-56 h-56 rounded-full bg-sand/5 blur-3xl -z-10" />

              {/* Web Dashboard mockup */}
              <div className="hidden rounded-2xl border border-white/5 bg-[#0e0d0c]/90 backdrop-blur-xl shadow-2xl overflow-hidden grid grid-cols-[160px_1fr] min-h-[500px] border-sand/5">
                {/* Dashboard Sidebar */}
                <div className="p-4 border-r border-white/5 bg-black/30 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 mb-6 px-2">
                    <div className="w-6 h-6 rounded-md bg-sand/10 text-sand flex items-center justify-center">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <b className="text-[10px] text-cream tracking-wide">Evergreen Res.</b>
                  </div>
                  
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-sand/10 text-sand border border-sand/20">
                    <Home className="w-3 h-3" /> Нүүр хуудас
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <Users className="w-3 h-3" /> Оршин суугч
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <CreditCard className="w-3 h-3" /> Төлбөр тооцоо
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <Zap className="w-3 h-3" /> Тоолуурын заалт
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <Wrench className="w-3 h-3" /> Засварын хүсэлт
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <Megaphone className="w-3 h-3" /> Зарлал, мэдээ
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <BarChart3 className="w-3 h-3" /> Санхүү тайлан
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] text-sand-400 font-medium hover:text-cream transition-colors">
                    <FileText className="w-3 h-3" /> Баримт бичиг
                  </span>
                </div>

                {/* Dashboard Main View */}
                <div className="p-5 flex flex-col gap-4 bg-[#0e0d0c]/30">
                  {/* Dashboard Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-sand-400 w-32">
                      <Search className="w-3 h-3 text-sand-400" />
                      <span className="text-[9px]">Хайх...</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-sand border border-white/5 relative">
                        <Bell className="w-3 h-3" />
                        <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-sand rounded-full" />
                      </div>
                      <div className="w-6 h-6 rounded-full border border-sand/40 overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=75&w=64&auto=format&fit=crop" alt="Хэрэглэгчийн зураг" width="24" height="24" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Metrics grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl border border-white/5 bg-[#121211]/80">
                      <span className="text-[8px] text-sand-400 uppercase tracking-wider font-semibold block">Нийт айл өрх</span>
                      <b className="text-sm text-cream font-serif font-light mt-1.5 block">812</b>
                      <span className="text-[7.5px] text-sand font-semibold block">↑ +5.8%</span>
                    </div>
                    <div className="p-3 rounded-xl border border-white/5 bg-[#121211]/80">
                      <span className="text-[8px] text-sand-400 uppercase tracking-wider font-semibold block">Энэ сарын орлого</span>
                      <b className="text-sm text-cream font-serif font-light mt-1.5 block">₮14.2M</b>
                      <span className="text-[7.5px] text-sand font-semibold block">↑ +8.2%</span>
                    </div>
                  </div>

                  {/* Line Chart & Stats */}
                  <div className="grid grid-cols-[1.3fr_0.7fr] gap-2">
                    {/* Bar Chart mockup */}
                    <div className="p-3 rounded-xl border border-white/5 bg-[#121211]/80 flex flex-col justify-between h-28">
                      <h4 className="text-[8px] uppercase tracking-wider font-bold text-sand-400">Орлого зарлага</h4>
                      <div className="h-14 flex items-end justify-between px-1 mt-1">
                        {[35, 55, 75, 50, 90, 65, 80].map((h, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 w-4">
                            <div 
                              className="w-1.5 rounded-t-sm bg-gradient-to-t from-sand/20 to-sand/90"
                              style={{ height: `${h}%` }}
                            />
                            <span className="text-[6px] text-sand-500 font-sans">{(i + 1) * 4}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Donut graphic */}
                    <div className="p-3 rounded-xl border border-white/5 bg-[#121211]/80 flex flex-col items-center justify-between h-28">
                      <h4 className="text-[8px] uppercase tracking-wider font-bold text-sand-400 self-start">Төлөлт</h4>
                      <div className="relative w-11 h-11">
                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#c5a880" strokeWidth="3.5" strokeDasharray="72, 100" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-sans font-bold text-cream">
                          72%
                        </div>
                      </div>
                      <span className="text-[6px] text-sand-400 font-medium">Төлсөн</span>
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div className="p-2.5 rounded-xl border border-white/5 bg-[#121211]/80 flex flex-col gap-1.5">
                    <h4 className="text-[8px] uppercase tracking-wider font-bold text-sand-400">Сүүлийн үйл ажиллагаа</h4>
                    <div className="flex justify-between items-center text-[8px] border-b border-white/5 pb-1">
                      <span className="text-cream font-medium">Бат-Эрдэнэ (1203)</span>
                      <span className="text-sand-400">Төлбөр төлөгдсөн</span>
                      <span className="text-sand font-bold">₮120,000</span>
                    </div>
                    <div className="flex justify-between items-center text-[8px]">
                      <span className="text-cream font-medium">Засварын хүсэлт #245</span>
                      <span className="text-sand-400">Амжилттай шийдвэрлэв</span>
                      <span className="text-sand border border-sand/20 bg-sand/5 px-1 py-0.5 rounded text-[6.5px]">Хаасан</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Smartphone Mockup with 3D Tilt Hover Effect */}
              <TiltedCard maxRotate={7} className="hidden absolute right-[-10px] top-[260px] w-48 p-3.5 rounded-[1.8rem] border-[4px] border-[#222] bg-[#0a0a09] shadow-2xl z-20">
                <div className="w-16 h-3.5 bg-slate-900 rounded-b-xl mx-auto -mt-3.5 mb-3" />
                
                {/* Phone Header */}
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="text-[6.5px] text-sand-400 block font-light">Сайн байна уу,</span>
                    <b className="text-[9px] text-cream font-medium block mt-0.5">Бат-Эрдэнэ </b>
                    <span className="text-[6px] text-sand font-bold block mt-0.5">🏠 Айл 1203</span>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-sand/10 border border-sand/20 text-sand flex items-center justify-center">
                    <Bell className="w-2.5 h-2.5" />
                  </div>
                </div>

                {/* Smartphone Background Image showing premium real estate */}
                <div className="h-20 rounded-xl overflow-hidden relative border border-white/5 mb-3">
                  <img 
                    src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=400&auto=format&fit=crop" 
                    alt="Орчин үеийн сууцны интерьер" width="400" height="160" loading="lazy" decoding="async"
                    className="w-full h-full object-cover brightness-[0.7]" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-2">
                    <span className="text-[6px] text-sand uppercase tracking-wider font-bold">Нэхэмжлэх</span>
                    <b className="text-xs text-cream font-serif font-light mt-0.5">₮120,000</b>
                  </div>
                </div>

                {/* Quick Action Button */}
                <button className="w-full py-1.5 rounded-lg bg-sand text-onyx font-bold text-[8.5px] hover:bg-cream transition-colors mb-3">
                  Яг одоо төлөх
                </button>

                {/* App Grid Icons */}
                <div className="grid grid-cols-3 gap-1 mb-2.5">
                  {['Төлбөр', 'Тоолуур', 'Засвар', 'Зарлал', 'Баримт', 'Профайл'].map((t, i) => {
                    const icons = [
                      <CreditCard className="w-3.5 h-3.5" />,
                      <Zap className="w-3.5 h-3.5" />,
                      <Wrench className="w-3.5 h-3.5" />,
                      <Megaphone className="w-3.5 h-3.5" />,
                      <FileText className="w-3.5 h-3.5" />,
                      <Settings className="w-3.5 h-3.5" />
                    ];
                    return (
                      <div key={i} className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-1">
                        <span className="text-sand">{icons[i]}</span>
                        <span className="text-[6px] font-semibold text-sand-300">{t}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom App Nav */}
                <div className="flex justify-around items-center border-t border-white/5 pt-2 text-[6px] text-sand-500">
                  <span className="text-sand font-bold">🏠 Нүүр</span>
                  <span>🔔 Мэдэгдэл</span>
                  <span>👤 Профайл</span>
                </div>
              </TiltedCard>

              {/* Floating glass notifications */}
              <div className="absolute left-[-22%] top-[79%] z-30 hidden w-[172px] items-center gap-2.5 rounded-2xl border border-emerald-300/20 bg-[#111713]/90 p-2.5 shadow-[0_16px_45px_rgba(0,0,0,.28)] backdrop-blur-xl animate-float-alert-1 xl:flex">
                <div className="w-6.5 h-6.5 rounded-full bg-sand/15 text-sand flex items-center justify-center font-bold text-xs">✓</div>
                <div>
                  <b className="text-[9px] text-cream block font-medium">Төлбөр амжилттай</b>
                  <small className="text-[7.5px] text-sand-400 block mt-0.5">Хүлээн авсан: ₮120,000</small>
                </div>
              </div>

              <div className="absolute bottom-[5%] right-[-3%] z-30 hidden w-[194px] items-center gap-3 rounded-2xl border border-sky-300/20 bg-[#11151a]/90 p-3 shadow-[0_16px_45px_rgba(0,0,0,.28)] backdrop-blur-xl animate-float-alert-2 lg:flex">
                <div className="w-6.5 h-6.5 rounded-full bg-sand/15 text-sand flex items-center justify-center text-xs">🔧</div>
                <div>
                  <b className="text-[9px] text-cream block font-medium">Засварын хүсэлт</b>
                  <small className="text-[7.5px] text-sand-400 block mt-0.5">Амжилттай илгээгдлөө #245</small>
                </div>
              </div>

              <div className="absolute right-[4%] top-[4%] z-30 hidden w-[180px] items-center gap-3 rounded-2xl border border-amber-300/20 bg-[#18150f]/90 p-3 shadow-[0_16px_45px_rgba(0,0,0,.28)] backdrop-blur-xl animate-float-alert-3 lg:flex">
                <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-sand/15 text-sand"><Megaphone className="h-3.5 w-3.5" /></div>
                <div>
                  <b className="text-[9px] text-cream block font-medium">Шинэ зарлал</b>
                  <small className="text-[7.5px] text-sand-400 block mt-0.5">СӨХ-өөс нийтлэгдлээ</small>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Production-ready operating flow */}
        <section id="workflow" className="max-w-7xl mx-auto px-6 lg:px-14 py-16 lg:py-20 border-b border-white/5">
          <div className="rounded-3xl border border-white/8 bg-[#121211]/60 p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <span className="text-[9px] font-sans font-bold text-sand uppercase tracking-[0.2em] block mb-2.5">Production-ready operations</span>
                <h2 className="text-3xl font-serif font-light text-cream mb-4">Байгууллагын өдөр тутмын урсгалыг нэг системд нэгтгэнэ.</h2>
                <p className="text-sand-400 font-sans font-light text-sm leading-relaxed max-w-xl">
                  Төлбөр, засвар, мэдэгдэл, санхүүгийн мэдээллийг салбар хооронд нь тасралтгүй, ил тод удирдах боломжтой.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { title: 'Төлбөр', desc: 'QR болон банкны гүйлгээг шууд хянах' },
                  { title: 'Засвар', desc: 'Хүсэлт, дараалал, шийдвэрлэлийг нэг дор' },
                  { title: 'Мэдээлэл', desc: 'Олон хэрэглэгчид нэгэн мэдээлэлд нэвтрэх' },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <h3 className="text-sm font-serif font-semibold text-cream">{item.title}</h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-sand-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features / Shaltgaanuud Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 lg:px-14 py-20 lg:py-24 border-b border-white/5">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[9px] font-sans font-bold text-sand uppercase tracking-[0.2em] block mb-2">Үндсэн боломжууд</span>
            <h2 className="text-3xl lg:text-4xl font-serif font-light text-cream">Smart Property ашиглах шалтгаанууд</h2>
            <p className="text-sand-400 font-sans font-light text-sm mt-3 leading-relaxed">
              СӨХ болон оршин суугчдын өдөр тутмын холбоо харилцааг хялбарчлах хамгийн сүүлийн үеийн ухаалаг систем.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: <CreditCard className="w-5.5 h-5.5 text-sand" />, title: 'QR төлбөр тооцоо', desc: 'Оршин суугчид QPay болон бүх банкны QR ашиглан төлбөрөө хормын дотор төлнө. СӨХ-ийн дансанд шууд, автоматаар бүртгэгдэнэ.' },
              { icon: <Wrench className="w-5.5 h-5.5 text-sand" />, title: 'Засвар үйлчилгээний систем', desc: 'Оршин суугчдаас ирүүлсэн засварын дуудлага, хүсэлт бүрийг эхнээс нь дуусах хүртэлх урсгалаар удирдаж, хугацаа болон чанарыг хянана.' },
              { icon: <Home className="w-5.5 h-5.5 text-sand" />, title: 'Оршин суугчийн тусгай апп', desc: 'Утсан дээрээсээ төлбөрийн түүх харах, тоолуурын заалт илгээх, СӨХ-д санал гомдол гаргах зэрэг бүх үйлдлийг нэг дороос шийднэ.' },
              { icon: <Megaphone className="w-5.5 h-5.5 text-sand" />, title: 'Зарлал, мэдэгдэл хүргэлт', desc: 'СӨХ-өөс гаргасан шийдвэр, мэдээлэл болон зарлалыг оршин суугчдын гар утсанд нь шуурхай push-мэдэгдэл хэлбэрээр нэгэн зэрэг илгээнэ.' },
              { icon: <BarChart3 className="w-5.5 h-5.5 text-sand" />, title: 'Санхүү, тайлан удирдлага', desc: 'СӨХ-ийн санхүүгийн орлого, зарлагыг систем дээр хөтөлж, тайланг оршин суугчдад ил тод нээлттэй байлгаснаар үл ойлголцлыг арилгана.' },
              { icon: <Zap className="w-5.5 h-5.5 text-sand" />, title: 'Ухаалаг тоолуурын заалт', desc: 'Оршин суугч тоолуурын заалтаа өөрөө оруулах эсвэл зургийг нь дараад илгээх боломжтой бөгөөд систем автоматаар нэхэмжлэх үүсгэнэ.' }
            ].map((card, idx) => (
              <SpotlightCard key={idx} className="p-6 flex flex-col gap-4 border border-white/5 bg-[#121211]/30 hover:border-sand/20 transition-all duration-300">
                <div className="w-11 h-11 rounded-lg bg-sand/10 border border-sand/20 flex items-center justify-center">
                  {card.icon}
                </div>
                <h3 className="text-sm font-serif font-semibold text-cream mt-1">{card.title}</h3>
                <p className="text-sand-400 font-sans font-light text-[11.5px] leading-relaxed">{card.desc}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        {/* Social proof removed from the landing flow. */}
        {false ? <>
        {/* Social proof */}
        <section className="max-w-7xl mx-auto px-6 lg:px-14 py-20 border-b border-white/5">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-10">
            <div className="max-w-xl">
              <span className="text-[9px] font-bold text-sand uppercase tracking-[0.22em]">Хамтрагчдын түүх</span>
              <h2 className="mt-3 text-3xl lg:text-4xl font-serif font-light text-cream">Өдөр тутмын ажил илүү тайван болно.</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-sand-400">СӨХ-ийн баг болон оршин суугчид нэг мэдээлэл, нэг урсгал, нэг ойлголттой ажиллана.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              { quote: 'Төлбөрийн нэгтгэл, оршин суугчийн хүсэлт, тайлангаа нэг дэлгэцээс хянадаг болсон.', name: 'Н.Энхжин', role: 'Менежер, River Garden' },
              { quote: 'Мэдэгдэл шууд очдог болсноор сар бүрийн авлагын асуулт эрс багассан.', name: 'Б.Тэмүүлэн', role: 'Санхүү, Blue Sky Residence' },
              { quote: 'Засварын ажлын явцыг ил тод хардаг болсон нь оршин суугчдын итгэлийг нэмсэн.', name: 'О.Марал', role: 'Удирдах зөвлөлийн гишүүн' },
            ].map((testimonial, index) => (
              <SpotlightCard key={testimonial.name} className="min-h-[220px] p-6 flex flex-col justify-between border border-white/5 bg-[#121211]/30">
                <Quote className="w-7 h-7 text-sand/70" />
                <p className="my-6 font-serif text-xl leading-relaxed text-cream">“{testimonial.quote}”</p>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-sand/15 text-xs font-bold text-sand">{testimonial.name.slice(0, 1)}</span>
                  <div><b className="block text-xs text-cream">{testimonial.name}</b><span className="text-[10px] text-sand-400">{testimonial.role}</span></div>
                  <span className="ml-auto text-[10px] text-sand/70">0{index + 1}</span>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </section>

        </> : null}

        {/* FAQ */}
        <section className="max-w-5xl mx-auto px-6 lg:px-14 py-20 border-b border-white/5">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <span className="text-[9px] font-bold text-sand uppercase tracking-[0.22em]">Түгээмэл асуулт</span>
              <h2 className="mt-3 text-3xl lg:text-4xl font-serif font-light text-cream">Танд асуух зүйл байна уу?</h2>
              <p className="mt-4 text-sm leading-relaxed text-sand-400">Манай баг танай хотхоны бүтэц, шилжилтийн төлөвлөгөөг хамт гаргана.</p>
            </div>
            <div className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-[#121211]/35 px-5">
              {[
                ['Өгөгдлөө яаж шилжүүлэх вэ?', 'Одоогийн айл, оршин суугч, төлбөрийн мэдээллийг Excel файлаас шалгаж, манай баг аюулгүй шилжүүлнэ.'],
                ['Оршин суугчид апп татах шаардлагатай юу?', 'Үгүй. Гар утас болон компьютероосоо веб хувилбараар шууд нэвтэрч болно.'],
                ['Төлбөрийн гүйлгээ автоматаар бүртгэгдэх үү?', 'Тийм. QR төлбөр болон холбогдсон банкны гүйлгээг автоматаар тулгаж, бодит цагийн төлөв харуулна.'],
                ['Дэмжлэг авах боломжтой юу?', 'Growth болон Enterprise багцад onboarding, сургалт, ажлын өдрийн support багтсан.'],
              ].map(([question, answer], index) => (
                <div key={question}>
                  <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left text-sm font-semibold text-cream">
                    {question}<ChevronDown className={`h-4 w-4 shrink-0 text-sand transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && <p className="-mt-1 pb-5 pr-8 text-sm leading-relaxed text-sand-400">{answer}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section id="start" className="max-w-7xl mx-auto px-6 lg:px-14 py-16">
          <div className="p-8 lg:p-14 rounded-3xl border border-sand/20 bg-[#0e0d0c]/80 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div>
              <span className="text-[9px] font-sans font-bold text-sand uppercase tracking-[0.2em] block mb-2.5">Хамтын хүчээр ухаалаг амьдрах орчныг бүтээнэ</span>
              <h2 className="text-2xl lg:text-3.5xl font-serif font-light text-cream leading-tight">
                СӨХ-ийн удирдлагыг өнөөдрөөс <br />
                шинэ түвшинд хүргээрэй.
              </h2>
              <p className="text-sand-300 font-sans font-light text-sm mt-4 max-w-xl leading-relaxed">
                СӨХ-ийн өдөр тутмын удирдлагыг нэг системээс хялбар зохион байгуулаарай.
                Оршин суугч, төлбөр, хүсэлт, зарлал болон тайланг нэгдсэн байдлаар удирдана.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <button 
                onClick={() => navigate(isAuthenticated && user ? getPostLoginPath(user.role, 'soh') : '/soh/register')}
                className="px-6 py-3.5 border border-sand/60 hover:border-sand bg-sand hover:bg-cream text-onyx font-bold rounded-full transition-all text-sm shadow-md shadow-sand/10"
              >
                {isAuthenticated ? 'Хяналтын самбар руу шилжих' : 'СӨХ бүртгүүлэх'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer id="contact" className="max-w-7xl mx-auto px-6 lg:px-14 pt-16 pb-8 border-t border-white/5 grid lg:grid-cols-[1.5fr_repeat(3,_1fr)] gap-12 text-xs">
        <div className="flex flex-col gap-4">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center text-sand">
              <Building className="w-4.5 h-4.5" />
            </div>
            <div>
              <b className="block text-sm font-serif font-semibold text-cream">HomeLink</b>
              <span className="block text-[7.5px] text-sand-400 font-sans font-bold tracking-[0.25em] uppercase">MANAGEMENT</span>
            </div>
          </a>
          <p className="text-sand-400 font-sans font-light leading-relaxed max-w-xs">
            СӨХ, орон сууц, оффис болон түрээсийн байрны удирдлагыг хөнгөвчлөх ухаалаг нэгдсэн систем.
          </p>
          <div className="flex items-center gap-2 mt-2">
            {[<Facebook className="w-4 h-4" />, <Instagram className="w-4 h-4" />, <Linkedin className="w-4 h-4" />, <Youtube className="w-4 h-4" />].map((icon, idx) => (
              <a key={idx} href="#" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-sand-400 hover:text-cream transition-colors" aria-label="Social Link">
                {icon}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-serif font-semibold text-cream uppercase tracking-wider mb-1">Бүтээгдэхүүн</h4>
          <a href="#home" className="text-sand-400 hover:text-cream transition-colors">Нүүр хуудас</a>
          <a href="#workflow" className="text-sand-400 hover:text-cream transition-colors">Ажиллагаа</a>
          <a href="#overview" className="text-sand-400 hover:text-cream transition-colors">Хотхоны бүтэц</a>
          <a href="#features" className="text-sand-400 hover:text-cream transition-colors">Үндсэн онцлог</a>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-serif font-semibold text-cream uppercase tracking-wider mb-1">Компани</h4>
          <a href="#" className="text-sand-400 hover:text-cream transition-colors">Бидний тухай</a>
          <a href="#" className="text-sand-400 hover:text-cream transition-colors">Хамтран ажиллах</a>
          <a href="#" className="text-sand-400 hover:text-cream transition-colors">Блог мэдээ</a>
          <a href="#" className="text-sand-400 hover:text-cream transition-colors">Нөхцөл, нууцлал</a>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="font-serif font-semibold text-cream uppercase tracking-wider mb-1">Холбоо барих</h4>
          <p className="flex items-center gap-2 text-sand-400"><Phone className="h-3.5 w-3.5 text-sand" />7777-8888</p>
          <p className="flex items-center gap-2 text-sand-400"><Mail className="h-3.5 w-3.5 text-sand" />info@smartproperty.mn</p>
          <p className="flex items-center gap-2 text-sand-400"><MapPin className="h-3.5 w-3.5 text-sand" />Улаанбаатар хот, Сүхбаатар дүүрэг</p>
        </div>
      </footer>

      <div className="max-w-7xl mx-auto px-6 lg:px-14 py-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] text-sand-500 uppercase tracking-wider">
        <span>© 2026 Smart Property Management. Бүх эрх хуулиар хамгаалагдсан.</span>
        <span className="font-medium text-sand-400">Хамтын хүчээр ухаалаг амьдрах орчныг бүтээнэ.</span>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={closeAuthModal} 
        initialMode={authModalMode} 
      />
    </div>
  );
}
