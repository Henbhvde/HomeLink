import { useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, Building2, Check, Cloud, Crown,
  RefreshCw, ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthModal from '../components/ui/AuthModal';
import pricingBuildings from '../assets/pricing-buildings-cutout.svg';

type Plan = {
  name: string;
  title: string;
  floors: string;
  residents: string;
  price: string;
  priceNote: string;
  features: string[];
  action: string;
  featured?: boolean;
  enterprise?: boolean;
};

const plans: Plan[] = [
  {
    name: 'START',
    title: 'Жижиг хотхон',
    floors: '3 давхар хүртэл',
    residents: 'Орон сууц: 50 хүртэл',
    price: '₮0',
    priceNote: 'Үнэгүй',
    features: ['Суурь удирдлага', 'Оршин суугчдын мэдээлэл', 'Зарлал, мэдэгдэл', 'Гомдол, хүсэлт'],
    action: 'ҮНЭГҮЙ ЭХЛЭХ',
  },
  {
    name: 'GROWTH',
    title: 'Өсөж буй хотхон',
    floors: '10 давхар хүртэл',
    residents: 'Орон сууц: 51 – 500',
    price: '₮199,000',
    priceNote: '/сар',
    features: ['Start багцын бүх боломж', 'Төлбөр, тооцоо', 'QR төлбөр, төлбөрийн систем', 'Тайлан, аналитик', 'Ээлж, хуваарь'],
    action: 'ЭХЛЭХ',
    featured: true,
  },
  {
    name: 'ENTERPRISE',
    title: 'Томоохон хотхон',
    floors: '20+ давхар',
    residents: 'Орон сууц: 500+',
    price: 'Үнэ тохирно',
    priceNote: 'Холбоо барина уу',
    features: ['Growth багцын бүх боломж', 'Олон барилга, салбар дэмжих', 'API интеграц', 'Тусгай тохиргоо', '24/7 Priority Support'],
    action: 'ХОЛБОО БАРИХ',
    enterprise: true,
  },
];

const comparisons = [
  ['Оршин суугчдын удирдлага', true, true, true],
  ['Төлбөр, тооцоо', false, true, true],
  ['QR төлбөр', false, true, true],
  ['Тайлан, аналитик', false, true, true],
  ['Олон барилга дэмжих', false, false, true],
  ['API интеграц', false, false, true],
  ['Priority Support', false, false, true],
] as const;

export default function PricingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('GROWTH');
  const navigate = useNavigate();

  const startPlan = (plan: Plan) => {
    if (plan.enterprise) navigate('/#contact');
    else setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#e8dfd0] text-[#20251f]">
      <header className="sticky top-0 z-40 border-b border-[#cfc6b8] bg-[#f3eee6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <button onClick={() => navigate('/manager')} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#315d49]/30 bg-[#315d49]/10"><Building2 className="h-4 w-4 text-[#315d49]" /></span>
            <span className="text-left"><b className="block font-serif text-lg">HomeLink</b><small className="block text-[7px] font-bold tracking-[.22em] text-[#73786f]">УДИРДЛАГА</small></span>
          </button>
          <button onClick={() => navigate('/manager')} className="inline-flex items-center gap-2 rounded-full border border-[#c8c0b4] px-4 py-2 text-xs font-semibold text-[#596057] hover:bg-[#315d49]/5"><ArrowLeft className="h-3.5 w-3.5" />Буцах</button>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-4 pb-14 pt-5 sm:px-8">
        <section className="relative overflow-hidden bg-[#f3eee6]">
          <div className="relative z-10 px-5 pt-8 text-center sm:px-10">
            <span className="inline-flex rounded-full border border-[#315d49]/20 bg-[#315d49]/10 px-4 py-1 text-[10px] font-bold tracking-[.18em] text-[#315d49]">ҮНИЙН БАГЦ</span>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-[-.045em] text-[#1f241f] sm:text-5xl">Танай хотхонд таарсан<br /><span className="text-[#697269]">төлөвлөгөөг сонгоорой</span></h1>
            <p className="mt-3 text-sm text-[#737a72]">Хэрэгцээ, өсөлттэй тань хамт хөгжих уян хатан төлөвлөгөөнүүд.</p>
          </div>

          <div className="relative mx-auto -mt-16 hidden h-[520px] max-w-[1100px] grid-cols-3 gap-4 px-5 lg:grid">
            {['left', 'center', 'right'].map((position, index) => (
              <div
                key={position}
                role="img"
                aria-label={`${plans[index].title} барилгын зураг`}
                className="relative overflow-hidden"
                style={{
                  backgroundImage: `url(${pricingBuildings})`,
                  backgroundPosition: `${position} bottom`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '300% auto',
                }}
              />
            ))}
          </div>
          <div className="relative mt-2 h-[280px] overflow-hidden lg:hidden">
            <img src={pricingBuildings} alt="Өөр өөр хэмжээтэй хотхонууд" width="1400" height="900" loading="lazy" decoding="async" className="h-full w-full object-contain object-bottom" />
          </div>

          <div className="relative z-10 mx-auto -mt-7 grid max-w-[1100px] gap-4 px-5 lg:-mt-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                role="button"
                tabIndex={0}
                aria-pressed={selectedPlan === plan.name}
                onClick={() => setSelectedPlan(plan.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedPlan(plan.name);
                }}
                className={`flex min-h-[410px] cursor-pointer flex-col rounded-[22px] border bg-[#fbf8f2]/95 p-6 shadow-[0_18px_55px_rgba(72,61,44,.12)] backdrop-blur-md transition-all duration-200 ${
                  selectedPlan === plan.name
                    ? 'border-[#315d49] ring-2 ring-[#315d49]/35 shadow-[0_18px_65px_rgba(49,93,73,.18)]'
                    : 'border-[#d2cabf] hover:border-[#315d49]/55'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="rounded-full bg-[#ded8cd] px-4 py-1 text-[10px] font-bold tracking-[.12em] text-[#4f574f]">{plan.name}</span>
                  {plan.featured && <span className="inline-flex items-center gap-1 rounded-full bg-[#315d49] px-3 py-1 text-[9px] font-bold text-white"><Crown className="h-3 w-3" />ХАМГИЙН ИХ СОНГОДОГ</span>}
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#315d49]/15 bg-gradient-to-br from-[#dce6de] to-[#c8d5ca]"><Building2 className="h-7 w-7 text-[#315d49]" /></span>
                  <div><h2 className="text-xl font-bold text-[#20251f]">{plan.title}</h2><p className="mt-2 text-xs text-[#4f574f]">▥ &nbsp;{plan.floors}</p><p className="mt-2 text-xs text-[#737a72]">{plan.residents}</p></div>
                </div>
                <div className="mt-5 border-t border-[#d5cdc1] pt-4">
                  <b className={`block tracking-[-.04em] ${plan.enterprise ? 'text-3xl' : 'text-4xl'} ${plan.featured ? 'text-[#315d49]' : 'text-[#20251f]'}`}>{plan.price}</b>
                  <span className="mt-1 block text-xs text-[#737a72]">{plan.priceNote}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-xs text-[#444b44]"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#dbe6dd] text-[#315d49]"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>{feature}</li>)}
                </ul>
                <button onClick={() => startPlan(plan)} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${selectedPlan === plan.name ? 'border-[#315d49] bg-[#315d49] text-white hover:bg-[#274d3b]' : 'border-[#8f998f] text-[#315d49] hover:bg-[#315d49]/5'}`}>{plan.action}<ArrowUpRight className="h-3.5 w-3.5" /></button>
              </article>
            ))}
          </div>

          <div className="relative z-10 mx-auto mt-4 grid max-w-[1240px] gap-4 px-5 pb-6 lg:grid-cols-[1fr_280px]">
            <div className="rounded-[22px] border border-[#d2cabf] bg-[#fbf8f2]/95 p-5">
              <h3 className="text-xs font-bold tracking-[.08em] text-[#315d49]">ТОВЧ ХАРЬЦУУЛАЛТ</h3>
              <div className="mt-3 grid grid-cols-[minmax(150px,1fr)_90px_90px_90px] text-center text-[10px] font-bold text-[#596159]">
                <span />
                {plans.map(plan => <span key={plan.name}>{plan.name}</span>)}
                {comparisons.flatMap(([label, ...values]) => [
                  <span key={`${label}-label`} className="border-t border-[#ded6ca] py-2 text-left text-xs font-normal text-[#444b44]">{label}</span>,
                  ...values.map((value, index) => <span key={`${label}-${index}`} className="grid place-items-center border-t border-[#ded6ca]">{value ? <Check className="h-4 w-4 rounded-full bg-[#315d49] p-0.5 text-white" /> : '—'}</span>),
                ])}
              </div>
            </div>
            <aside className="grid gap-3 rounded-[22px] border border-[#d2cabf] bg-[#fbf8f2]/95 p-5">
              {[
                [ShieldCheck, 'Аюулгүй, найдвартай', 'Өгөгдөл 256-бит шифрлэлээр хамгаалагдана.'],
                [Cloud, 'Үүлэн технологи', 'Хаанаас ч, хэзээ ч хандах боломжтой.'],
                [RefreshCw, 'Үргэлж шинэчлэгддэг', 'Шинэ боломжууд тогтмол нэмэгдэнэ.'],
              ].map(([Icon, title, text]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return <div key={title as string} className="flex gap-3"><FeatureIcon className="h-7 w-7 shrink-0 text-[#315d49]" /><div><b className="text-xs">{title as string}</b><p className="mt-1 text-[11px] leading-4 text-[#737a72]">{text as string}</p></div></div>;
              })}
            </aside>
          </div>
        </section>
      </main>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} initialMode="signup" />
    </div>
  );
}
