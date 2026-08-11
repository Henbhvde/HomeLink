import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileText,
  QrCode,
  ReceiptText,
  WalletCards,
  X,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useResidentPortal } from '../contexts/ResidentPortalContext';
import { apiClient, type QpayInvoice, type ResidentBillingSummary } from '../services/api/client';

type Receipt = {
  id: string;
  month: string;
  paidAt: string;
  amount: string;
  method: string;
  reference: string;
};

function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-sand/25 bg-[#171714] p-6 shadow-2xl shadow-black/60">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-sand-300 transition hover:bg-white/7"
          aria-label="Хаах"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function ResidentPaymentsPage() {
  const { token } = useAuth();
  const { selectedUnit } = useResidentPortal();
  const [showPay, setShowPay] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [qpayInvoice, setQpayInvoice] = useState<QpayInvoice | null>(null);
  const [qpayLoading, setQpayLoading] = useState(false);
  const [qpayError, setQpayError] = useState<string | null>(null);
  const [billing, setBilling] = useState<ResidentBillingSummary | null>(null);
  const paymentCardClass = 'h-full overflow-hidden border-sand/20 bg-[linear-gradient(145deg,rgba(43,42,38,.92),rgba(25,26,23,.96))] shadow-[0_16px_38px_rgba(0,0,0,.16)]';
  const currentInvoice = billing?.currentInvoice;
  const currentLines = currentInvoice?.lines ?? [];
  const currentPayments = billing?.payments ?? [];
  const currentAmount = currentInvoice?.amount ?? '₮0';
  const currentDue = currentInvoice?.due ?? '-';
  const currentPeriod = currentPayments[0]?.month ?? new Date().toISOString().slice(0, 7);
  const paymentTimeline = [
    ...currentPayments.slice(0, 2).reverse().map((payment) => ({
      key: payment.id,
      month: payment.month,
      amount: payment.amount,
      status: 'Төлөгдсөн',
      dot: 'bg-emerald-300',
    })),
    ...(currentInvoice ? [{
      key: currentInvoice.id,
      month: currentPeriod,
      amount: currentAmount,
      status: 'Хүлээгдэж буй',
      dot: 'bg-sand ring-4 ring-sand/10',
    }] : []),
  ];
  const dueDays = (() => {
    if (!currentInvoice) return null;
    const [month, day] = currentDue.split('.').map(Number);
    if (!month || !day) return null;
    const due = new Date(new Date().getFullYear(), month - 1, day);
    return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  })();

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const requestPaymentConfirmation = () => {
    setShowPay(false);
    setPaymentRequested(true);
    notify('Төлбөрийн баталгаажуулалтыг хүлээж байна. Амжилттай болсны дараа баримт энд нэмэгдэнэ.');
  };

  useEffect(() => {
    if (!token) return;
    void apiClient.getResidentBillingSummary(token).then(setBilling).catch(() => undefined);
  }, [token]);

  const openQpay = async () => {
    setShowPay(true);
    setQpayError(null);
    const invoiceId = currentInvoice?.id;
    if (!token || qpayInvoice) return;
    if (!invoiceId) {
      setQpayError('Төлөх нэхэмжлэл алга.');
      return;
    }
    setQpayLoading(true);
    try {
      setQpayInvoice(await apiClient.createQpayInvoice(token, invoiceId));
    } catch (error) {
      setQpayError(error instanceof Error ? error.message : 'QPay invoice үүсгэж чадсангүй.');
    } finally {
      setQpayLoading(false);
    }
  };

  if (!selectedUnit) return <Navigate to="/resident" replace />;

  return (
    <section className="space-y-5 pb-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">{selectedUnit} · EVERGREEN RESIDENCE</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream sm:text-4xl">Төлбөр ба баримт.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-400">Энэ сарын нэхэмжлэл, төлөлтийн түүх болон албан баримтаа нэг дороос харна.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-sand-400">
          <CalendarDays className="h-4 w-4 text-sand" />
          <span>{currentPeriod}</span>
        </div>
      </header>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Card className={paymentCardClass}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.17em] text-sand">ЭНЭ САРЫН ҮЛДЭГДЭЛ</p>
                <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                  <b className="text-4xl font-semibold tracking-tight text-cream sm:text-5xl">{currentAmount}</b>
                  <Badge tone="warning" className="mb-1">due {currentDue}</Badge>
                </div>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sand/25 bg-sand/10 text-sand">
                <WalletCards className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-black/15 px-4 py-1">
              {currentLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-4 border-b border-white/7 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-sm text-cream">{line.label}</b>
                      {line.tone && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                    </div>
                    <span className="mt-0.5 block text-xs text-sand-400">{line.detail}</span>
                  </div>
                  <b className="shrink-0 text-sm text-cream">{line.amount}</b>
                </div>
              ))}
              {!currentLines.length && <p className="py-5 text-center text-sm text-sand-400">Төлөх нэхэмжлэл алга.</p>}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1" onClick={openQpay} loading={qpayLoading} disabled={!currentInvoice}>
                <CreditCard className="h-4 w-4" /> Төлөх
              </Button>
              <button
                onClick={() => notify('Нэхэмжлэлийн PDF татах бэлтгэгдлээ.')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 px-4 text-sm font-semibold text-sand-200 transition hover:border-sand/45 hover:bg-white/[.04]"
              >
                <FileText className="h-4 w-4" /> Нэхэмжлэл татах
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className={paymentCardClass}>
          <CardContent className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.17em] text-sand">ТӨЛӨЛТИЙН ХЭМНЭЛ</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-cream">Таны сарын хэмнэл</h2>
              </div>
              <Badge tone={currentPayments.length ? 'success' : 'neutral'}>{currentPayments.length} төлөлт</Badge>
            </div>

            <div className="relative mt-7 grid grid-cols-3 gap-2 before:absolute before:left-[15%] before:right-[15%] before:top-4 before:h-px before:bg-gradient-to-r before:from-emerald-300/35 before:via-sand/60 before:to-sand/25">
              {paymentTimeline.map((item) => (
                <div key={item.key} className="relative z-10 text-center">
                  <span className={`mx-auto block h-3 w-3 rounded-full ${item.dot}`} />
                  <b className="mt-3 block text-xs text-cream">{item.month}</b>
                  <span className="mt-1 block text-[11px] text-sand-300">{item.amount}</span>
                  <small className="mt-1 block text-[10px] text-sand-500">{item.status}</small>
                </div>
              ))}
            </div>
            {!paymentTimeline.length && <p className="mt-8 text-center text-sm text-sand-400">Төлбөрийн мэдээлэл алга.</p>}

            <div className="mt-auto flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.055] p-3.5 pt-3.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
              <p className="text-xs leading-relaxed text-sand-300">Нийт {currentPayments.length} баталгаажсан төлөлт бүртгэгдсэн байна.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Card className={paymentCardClass}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.17em] text-sand">PAYMENT HISTORY</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-cream">Recent payments</h2>
              </div>
              <Badge tone="neutral">{currentPayments.length} receipts</Badge>
            </div>
            <div className="mt-5 divide-y divide-white/7">
              {currentPayments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                      <ReceiptText className="h-4 w-4" />
                    </span>
                    <div>
                      <b className="block text-sm text-cream">{payment.month}</b>
                      <span className="mt-1 block text-xs text-sand-400">{payment.method} · {payment.paidAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <b className="block text-sm text-cream">{payment.amount}</b>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> Төлөгдсөн</span>
                    </div>
                    <button
                      onClick={() => setSelectedReceipt(payment)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 transition hover:border-sand/45 hover:bg-sand/10 hover:text-cream"
                      aria-label={`${payment.month}-ын баримт харах`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!currentPayments.length && <p className="py-8 text-center text-sm text-sand-400">Төлөлтийн түүх алга.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className={paymentCardClass}>
          <CardContent className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.17em] text-amber-100">ТӨЛӨЛТИЙН САНУУЛГА</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-cream">{currentInvoice ? `${currentPeriod} төлбөр` : 'Төлөх нэхэмжлэл алга'}</h2>
              </div>
              <Clock3 className="h-5 w-5 text-amber-200" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-sand-300">{currentInvoice ? `${currentDue}-наас өмнө төлбөрөө төлнө үү.` : 'Одоогоор үлдэгдэл төлбөр байхгүй байна.'}</p>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-4 py-3">
              <span className="text-xs text-sand-400">Үлдсэн хугацаа</span>
              <b className="text-sm text-cream">{dueDays === null ? '-' : dueDays < 0 ? `${Math.abs(dueDays)} өдөр хэтэрсэн` : `${dueDays} өдөр`}</b>
            </div>
            <Button variant="outline" className="mt-auto w-full" onClick={openQpay} loading={qpayLoading} disabled={!currentInvoice}>
              <QrCode className="h-4 w-4" /> QPay нээх
            </Button>
          </CardContent>
        </Card>
      </div>

      {showPay && (
        <Dialog onClose={() => setShowPay(false)}>
          <p className="text-[10px] font-bold tracking-[.17em] text-sand">QPAY ТӨЛБӨР</p>
          <h2 className="mt-2 pr-8 font-serif text-3xl font-light text-cream">Pay {currentAmount}</h2>
          <p className="mt-2 text-sm leading-relaxed text-sand-400">Банкны апп-аараа доорх QR кодыг уншуулаад төлбөрөө баталгаажуулна уу.</p>

          <div className="mx-auto mt-6 grid h-56 w-56 place-items-center rounded-2xl bg-cream p-4 shadow-[0_12px_35px_rgba(217,202,172,.16)]">
            {qpayInvoice?.qrImage ? (
              <img className="h-48 w-48 object-contain" alt="QPay QR" src={qpayInvoice.qrImage.startsWith('data:') ? qpayInvoice.qrImage : `data:image/png;base64,${qpayInvoice.qrImage}`} />
            ) : (
              <QrCode className="h-44 w-44 text-onyx" strokeWidth={1.25} />
            )}
          </div>
          {qpayError && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">{qpayError}</p>}
          {qpayInvoice?.shortUrl && <a className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-sand px-4 text-sm font-semibold text-onyx" href={qpayInvoice.shortUrl} target="_blank" rel="noreferrer">QPay link нээх</a>}
          {!!qpayInvoice?.deeplinks.length && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {qpayInvoice.deeplinks.slice(0, 6).map((link) => <a key={link.name} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-semibold text-sand-100 hover:border-sand/40" href={link.link}>{link.name}</a>)}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/9 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-sand-400">Төлөгч</span><b className="text-cream">{selectedUnit} · Бат-Эрдэнэ</b></div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-sand-400">Хүчинтэй хугацаа</span><b className="text-cream">15 минут</b></div>
          </div>

          <Button className="mt-5 w-full" onClick={requestPaymentConfirmation}>
            <CheckCircle2 className="h-4 w-4" /> Би төлсөн
          </Button>
        </Dialog>
      )}

      {selectedReceipt && (
        <Dialog onClose={() => setSelectedReceipt(null)}>
          <div className="flex items-start gap-3 pr-8">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-300/12 text-emerald-200"><ReceiptText className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-bold tracking-[.17em] text-sand">ТӨЛБӨРИЙН БАРИМТ</p><h2 className="mt-1 font-serif text-2xl text-cream">{selectedReceipt.month}</h2></div>
          </div>
          <div className="mt-6 space-y-3 rounded-2xl border border-white/9 bg-black/20 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-sand-400">Төлсөн дүн</span><b className="text-cream">{selectedReceipt.amount}</b></div>
            <div className="flex justify-between gap-4"><span className="text-sand-400">Арга</span><b className="text-cream">{selectedReceipt.method}</b></div>
            <div className="flex justify-between gap-4"><span className="text-sand-400">Огноо</span><b className="text-cream">{selectedReceipt.paidAt}</b></div>
            <div className="flex justify-between gap-4"><span className="text-sand-400">Гүйлгээний код</span><b className="text-right text-xs text-cream">{selectedReceipt.reference}</b></div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Төлбөр амжилттай баталгаажсан.</div>
          <Button variant="outline" className="mt-5 w-full" onClick={() => notify(`${selectedReceipt.id} баримт татах бэлтгэгдлээ.`)}><FileText className="h-4 w-4" /> Баримт татах</Button>
        </Dialog>
      )}

      {paymentRequested && <div className="fixed bottom-20 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-300/25 bg-[#3a301b] px-4 py-3.5 text-sm text-amber-50 shadow-xl shadow-black/40 sm:bottom-6"><CircleAlert className="h-4 w-4 shrink-0 text-amber-200" />Банкны баталгаажуулалт ирмэгц төлөлт таны түүхэд автоматаар орно.</div>}
      {toast && <div className="fixed bottom-20 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-400/25 bg-[#17352d] px-4 py-3.5 text-center text-sm text-emerald-50 shadow-xl sm:bottom-6"><CheckCircle2 className="mr-2 inline h-4 w-4" />{toast}</div>}
    </section>
  );
}

