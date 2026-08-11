import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Building2, Check, ChevronLeft, CreditCard, Landmark, LockKeyhole, MapPin, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { completeStripeReturnApi, createOnboardingCheckoutApi, createOrganizationRequestApi, registerApi, verifyOnboardingPaymentApi, type OnboardingCheckout } from '../services/authApi';
import { useAuth } from '../contexts/AuthContext';

type Plan = 'Basic' | 'Standard' | 'Pro';

const plans: Record<Plan, { price: string; detail: string; features: string[] }> = {
  Basic: { price: '₮49,000 / сар', detail: '100 хүртэл айлд', features: ['Оршин суугч, зарлал', 'Засвар, хүсэлт', 'Үндсэн тайлан'] },
  Standard: { price: '₮149,000 / сар', detail: '500 хүртэл айлд', features: ['Basic багцын бүх боломж', 'Төлбөр, нэхэмжлэл', 'Карт төлбөр, тайлан'] },
  Pro: { price: '₮299,000 / сар', detail: 'Олон барилга, том СӨХ-д', features: ['Standard багцын бүх боломж', 'Олон барилга', 'Тусгай дэмжлэг'] },
};

export default function SohRegistrationPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const handledStripeReturn = useRef(false);
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<Plan>('Standard');
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [message, setMessage] = useState('');
  const [checkout, setCheckout] = useState<OnboardingCheckout | null>(null);
  const [form, setForm] = useState({
    hoaName: '', propertyName: '', location: '', contactName: '', phone: '', email: '', password: '', buildingCount: '1', unitCount: '100',
  });

  const suggestedPlan = useMemo<Plan>(() => {
    const units = Number(form.unitCount) || 0;
    const buildings = Number(form.buildingCount) || 0;
    return units > 500 || buildings > 3 ? 'Pro' : units > 100 ? 'Standard' : 'Basic';
  }, [form.buildingCount, form.unitCount]);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const continueToPlans = (event: FormEvent) => {
    event.preventDefault();
    if (!form.hoaName || !form.propertyName || !form.location || !form.contactName || !form.phone || !form.email || !form.password) {
      setMessage('Байгууллага болон холбоо барих мэдээллээ бүрэн оруулна уу.');
      return;
    }
    if (form.password.length < 8) {
      setMessage('Нууц үг хамгийн багадаа 8 тэмдэгт байна.');
      return;
    }
    setPlan(suggestedPlan);
    setMessage('');
    setStep(2);
  };

  const submit = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (!isAuthenticated || user?.email !== form.email) {
        const session = await registerApi({ email: form.email, password: form.password, fullName: form.contactName, phone: form.phone, role: 'manager', workspaceName: form.hoaName });
        login(session.user, session.token);
      }
      const platformPlan = plan === 'Basic' ? 'Start' : plan === 'Standard' ? 'Growth' : 'Enterprise';
      const request = await createOrganizationRequestApi(form.hoaName, form.location, platformPlan);
      const paymentCheckout = await createOnboardingCheckoutApi(request.id);
      setCheckout(paymentCheckout);
      window.sessionStorage.setItem('homelink-soh-setup', JSON.stringify({ hoaName: form.hoaName, plan, tenantId: request.id }));
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error && error.message.includes('already exists') ? 'Энэ и-мэйл өмнө нь бүртгэгдсэн байна. Нэвтрэх товчоор орно уу.' : error instanceof Error ? error.message : 'Бүртгүүлэхэд алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!checkout) return;
    setCheckingPayment(true);
    setMessage('');
    try {
      const result = await verifyOnboardingPaymentApi(checkout.tenantId);
      if (!result.paid) {
        setMessage('Төлбөр хараахан баталгаажаагүй байна. Төлсний дараа дахин шалгана уу.');
        return;
      }
      if (!result.session) throw new Error('Manager session үүссэнгүй.');
      login(result.session.user, result.session.token);
      navigate('/manager', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа.');
    } finally {
      setCheckingPayment(false);
    }
  };

  const startStripePayment = () => {
    if (!checkout) return;
    window.location.assign(checkout.checkoutUrl);
  };

  useEffect(() => {
    if (authLoading || handledStripeReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get('tenant_id');
    const sessionId = params.get('session_id');
    if (params.get('payment') !== 'success' || !tenantId || !sessionId) return;
    handledStripeReturn.current = true;
    setStep(3);
    setCheckingPayment(true);
    void (async () => {
      let paid = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const result = await completeStripeReturnApi(tenantId, sessionId);
        if (result.paid && result.session) {
          paid = true;
          login(result.session.user, result.session.token);
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!paid) throw new Error('Stripe webhook төлбөрийг хараахан баталгаажуулаагүй байна.');
      navigate('/manager', { replace: true });
    })().catch((error) => setMessage(error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа.')).finally(() => setCheckingPayment(false));
  }, [authLoading, login, navigate]);

  return <main className="min-h-screen bg-[#f3eee6] px-4 py-8 text-[#20251f] sm:px-6">
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#d7cfc2] bg-[#fbf8f2] shadow-[0_22px_70px_rgba(58,49,36,.16)]">
      <header className="flex items-center justify-between border-b border-[#ded6ca] px-6 py-5 sm:px-9">
        <Link to="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#315d49] text-white"><Building2 className="h-5 w-5" /></span><span><b className="block font-serif text-lg">HomeLink</b><small className="text-[9px] font-bold tracking-[.18em] text-[#6b746d]">СӨХ УДИРДЛАГА</small></span></Link>
        <Link to="/login" className="text-sm font-semibold text-[#315d49] hover:underline">Нэвтрэх</Link>
      </header>
      <div className="border-b border-[#ded6ca] px-6 py-4 sm:px-9"><div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold"><span className={step >= 1 ? 'text-[#315d49]' : 'text-[#9a9d95]'}>1. СӨХ-ийн мэдээлэл</span><span className={step >= 2 ? 'text-[#315d49]' : 'text-[#9a9d95]'}>2. Багц сонгох</span><span className={step >= 3 ? 'text-[#315d49]' : 'text-[#9a9d95]'}>3. Идэвхжүүлэх</span></div></div>
      <div className="p-6 sm:p-9">
        {step === 1 && <form onSubmit={continueToPlans} className="mx-auto max-w-2xl"><p className="text-xs font-bold tracking-[.16em] text-[#6f826f]">СӨХ-ИЙН БҮРТГЭЛ</p><h1 className="mt-2 font-serif text-3xl">Байгууллагын үндсэн мэдээлэл</h1><p className="mt-2 text-sm leading-6 text-[#6d746d]">Бүртгэлийн дараа таны СӨХ-д тохирсон багцыг санал болгоно.</p><div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Field icon={<Building2 />} label="СӨХ-ийн нэр" value={form.hoaName} onChange={update('hoaName')} placeholder="Жишээ: Нарлаг Өргөө СӨХ" />
          <Field icon={<Landmark />} label="Хотхон / барилгын нэр" value={form.propertyName} onChange={update('propertyName')} placeholder="Нарлаг Өргөө хотхон" />
          <Field icon={<MapPin />} label="Байршил" value={form.location} onChange={update('location')} placeholder="БЗД, Улаанбаатар" />
          <Field icon={<Users />} label="Холбоо барих хүн" value={form.contactName} onChange={update('contactName')} placeholder="Овог нэр" />
          <Field label="Утасны дугаар" value={form.phone} onChange={update('phone')} placeholder="9911 2233" type="tel" minLength={8} />
          <Field label="И-мэйл хаяг" value={form.email} onChange={update('email')} placeholder="manager@soh.mn" type="email" />
          <Field label="Барилгын тоо" value={form.buildingCount} onChange={update('buildingCount')} type="number" />
          <Field label="Айлын тоо" value={form.unitCount} onChange={update('unitCount')} type="number" />
          <div className="sm:col-span-2"><Field icon={<LockKeyhole />} label="Нууц үг" value={form.password} onChange={update('password')} placeholder="Хамгийн багадаа 8 тэмдэгт" type="password" minLength={8} /></div>
        </div>{message && <p className="mt-4 text-sm text-red-600">{message}</p>}<button className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#315d49] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#274d3b]">Үргэлжлүүлэх</button></form>}
        {step === 2 && <div><button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#315d49]"><ChevronLeft className="h-4 w-4" />Мэдээлэл засах</button><div className="mt-4 text-center"><p className="text-xs font-bold tracking-[.16em] text-[#6f826f]">ТАНД САНАЛ БОЛГОЖ БУЙ</p><h1 className="mt-2 font-serif text-3xl">Тохирох багцаа сонгоно уу</h1><p className="mt-2 text-sm text-[#6d746d]"><b>{form.unitCount} айл, {form.buildingCount} барилга</b>-д тулгуурлан {suggestedPlan} багцыг санал болгож байна.</p></div><div className="mt-7 grid gap-4 md:grid-cols-3">{(Object.keys(plans) as Plan[]).map((name) => <button key={name} onClick={() => setPlan(name)} className={`rounded-2xl border p-5 text-left transition ${plan === name ? 'border-[#315d49] bg-[#edf3ee] ring-2 ring-[#315d49]/20' : 'border-[#d8d0c5] bg-white hover:border-[#315d49]/50'}`}><div className="flex items-center justify-between"><b className="text-lg">{name}</b>{plan === name && <Check className="h-5 w-5 text-[#315d49]" />}</div><p className="mt-2 text-sm font-bold text-[#315d49]">{plans[name].price}</p><p className="mt-1 text-xs text-[#72786f]">{plans[name].detail}</p><ul className="mt-4 space-y-2 text-xs text-[#4f574f]">{plans[name].features.map((feature) => <li key={feature} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-[#315d49]" />{feature}</li>)}</ul></button>)}</div>{message && <p className="mt-4 text-sm text-red-600">{message}</p>}<button disabled={loading} onClick={submit} className="mx-auto mt-7 inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#315d49] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60"><CreditCard className="h-4 w-4" />{loading ? 'Бүртгэж байна…' : `${plan} багцын хүсэлт илгээх`}</button><p className="mt-3 text-center text-xs text-[#737a72]">Төлбөрийн нэхэмжлэл, идэвхжүүлэлтийг админ баталгаажуулна.</p></div>}
        {step === 3 && checkout && <div className="mx-auto max-w-xl py-8 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#635bff]/10 text-[#635bff]"><CreditCard className="h-8 w-8" /></span><p className="mt-5 text-xs font-bold tracking-[.16em] text-[#635bff]">STRIPE TEST PAYMENT</p><h1 className="mt-2 font-serif text-3xl">Тест картаар төлбөр хийх</h1><p className="mt-3 text-sm text-[#636b63]"><b>{plan}</b> багцын 1 сарын төлбөр</p><p className="mt-2 text-2xl font-bold text-[#315d49]">₮{checkout.amount.toLocaleString('en-US')}</p><div className="mx-auto mt-5 max-w-sm rounded-xl border border-[#d8d0c5] bg-white p-4 text-left text-xs leading-5 text-[#636b63]"><b className="block text-[#20251f]">Stripe test карт</b><span>4242 4242 4242 4242</span><br /><span>Хугацаа: ирээдүйн огноо · CVC: дурын 3 орон</span></div>{message && <p className="mt-4 text-sm text-red-600">{message}</p>}<button disabled={checkingPayment} onClick={startStripePayment} className="mt-6 inline-flex min-w-64 items-center justify-center gap-2 rounded-xl bg-[#635bff] px-6 py-3.5 text-sm font-bold text-white disabled:opacity-60"><CreditCard className="h-4 w-4" />Stripe test төлбөр хийх</button><button disabled={checkingPayment} onClick={verifyPayment} className="mx-auto mt-3 block text-xs font-semibold text-[#315d49] underline">{checkingPayment ? 'Шалгаж байна…' : 'Төлбөрийн төлөв дахин шалгах'}</button></div>}
        {step === 3 && !checkout && checkingPayment && <div className="py-20 text-center"><p className="font-serif text-2xl">Stripe төлбөр баталгаажуулж байна…</p></div>}
      </div>
    </section>
  </main>;
}

function Field({ label, icon, ...props }: { label: string; icon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-xs font-bold text-[#596159]"><span className="mb-2 flex items-center gap-1.5">{icon}{label}</span><input {...props} required className="w-full rounded-xl border border-[#d8d0c5] bg-white px-3.5 py-3 text-sm font-normal text-[#20251f] outline-none transition focus:border-[#315d49] focus:ring-2 focus:ring-[#315d49]/15" /></label>;
}
