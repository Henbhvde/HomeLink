import { useRef, useState, type FormEvent } from 'react';
import { useBackendState } from '../hooks/useBackendState';
import { CheckCircle2, FileImage, ImagePlus, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type Expense = {
  id: string;
  date: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: string;
  receiptName?: string;
};

const categories = ['Засвар үйлчилгээ', 'Нийтийн хэрэглээ', 'Цэвэрлэгээ', 'Харуул хамгаалалт', 'Удирдлагын зардал', 'Бусад'];

const initialExpenses: Expense[] = [
  { id: 'EXP-2026-078', date: '2026.07.24', title: 'Лифтний урсгал засвар', category: 'Засвар үйлчилгээ', amount: 480000, paymentMethod: 'Банкны шилжүүлэг', receiptName: 'lift-service-0724.jpg' },
  { id: 'EXP-2026-077', date: '2026.07.22', title: 'Орцны цэвэрлэгээ', category: 'Цэвэрлэгээ', amount: 320000, paymentMethod: 'Банкны шилжүүлэг', receiptName: 'cleaning-invoice.pdf' },
  { id: 'EXP-2026-076', date: '2026.07.20', title: 'Нийтийн гэрлийн төлбөр', category: 'Нийтийн хэрэглээ', amount: 645000, paymentMethod: 'Дансаар', receiptName: 'power-bill-july.png' },
];

const formatMnt = (amount: number) => `₮${new Intl.NumberFormat('mn-MN').format(amount)}`;

export default function ExpensePage() {
  const [expenses, setExpenses, status, retry] = useBackendState<Expense[]>('expense-records', initialExpenses);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '2026-07-24', title: '', category: categories[0], amount: '', paymentMethod: 'Банкны шилжүүлэг', note: '' });
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expensesByCategory = categories.map((category) => ({ category, total: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0) })).filter((item) => item.total > 0);

  const resetDialog = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setReceiptFile(null);
    setPreviewUrl(null);
    setForm({ date: '2026-07-24', title: '', category: categories[0], amount: '', paymentMethod: 'Банкны шилжүүлэг', note: '' });
    setIsCreateOpen(false);
  };

  const handleReceiptChange = (file: File | undefined) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setReceiptFile(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const saveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount.replaceAll(',', ''));
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setExpenses((current) => [{ id: `EXP-2026-${String(current.length + 79).padStart(3, '0')}`, date: form.date.replaceAll('-', '.'), title: form.title.trim(), category: form.category, amount, paymentMethod: form.paymentMethod, receiptName: receiptFile?.name }, ...current]);
    setNotice('Зарлага амжилттай бүртгэгдлээ.');
    window.setTimeout(() => setNotice(''), 2800);
    resetDialog();
  };

  const deleteExpense = (expense: Expense) => {
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    setSelectedExpense(null);
    setNotice(`${expense.id} зарлагыг устгалаа.`);
    window.setTimeout(() => setNotice(''), 2800);
  };

  return (
    <PageStateWrapper
      status={status}
      isEmpty={expenses.length === 0 && !isCreateOpen}
      onRetry={retry}
      emptyIcon={ReceiptText}
      emptyTitle="Одоогоор зарлага алга"
      emptyDescription="Эхний зардлаа бүртгэж эхлээд санхүүгийн бүртгэлээ хялбархан удирдаарай."
      emptyAction={<Button onClick={() => setIsCreateOpen(true)}>Зарлага бүртгэх</Button>}
    >
      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold tracking-[.18em] text-sand">FR-7.1 · EXPENSE LEDGER</p><h1 className="mt-2 font-serif text-3xl font-light text-cream">Зарлагын бүртгэл.</h1><p className="mt-2 max-w-2xl text-sm text-sand-400">Зарлагыг ангилал, төлбөрийн мэдээлэл, баримтын зурагтай нь хамт бүртгэнэ.</p></div>
        <Button onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" />Зарлага бүртгэх</Button>
      </div>

      {notice && <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-100"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{notice}</span><button type="button" onClick={() => setNotice('')} className="text-emerald-100/70 hover:text-emerald-50" aria-label="Мэдэгдэл хаах"><X className="h-4 w-4" /></button></div>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-[11px] text-sand-400">2026 оны 7-р сарын зарлага</p><b className="mt-2 block font-sans text-3xl font-semibold tracking-tight text-cream">{formatMnt(total)}</b><p className="mt-2 text-xs text-sand-500">{expenses.length} баримт бүртгэгдсэн</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sand/10 text-sand"><ReceiptText className="h-5 w-5" /></span></CardContent></Card><Card><CardContent className="p-5"><p className="text-[11px] text-sand-400">Баримт хавсаргасан</p><div className="mt-3 flex items-end justify-between"><b className="font-sans text-3xl font-semibold tracking-tight text-cream">{expenses.filter((expense) => expense.receiptName).length}/{expenses.length}</b><Badge tone="success">Бүрэн</Badge></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full w-full rounded-full bg-emerald-300" /></div></CardContent></Card></div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><Card className="overflow-hidden"><CardHeader className="border-b border-white/7 pb-5"><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">EXPENSES</p><h2 className="mt-1 font-serif text-xl text-cream">Сүүлийн зарлагууд</h2></div></CardHeader><CardContent className="p-0">{/* Desktop Table */}<div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500"><tr><th className="px-5 py-3">ЗАРЛАГА</th><th className="px-5 py-3">АНГИЛАЛ</th><th className="px-5 py-3">ОГНОО</th><th className="px-5 py-3">ДҮН</th><th className="px-5 py-3">БАРИМТ</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id} onClick={() => setSelectedExpense(expense)} className="cursor-pointer border-b border-white/[.06] text-xs hover:bg-white/[.025]"><td className="px-5 py-4"><b className="block text-cream">{expense.title}</b><small className="text-[10px] text-sand-500">{expense.id} · {expense.paymentMethod}</small></td><td className="px-5 py-4"><Badge tone="neutral">{expense.category}</Badge></td><td className="px-5 py-4 text-sand-300">{expense.date}</td><td className="px-5 py-4 font-semibold text-cream">{formatMnt(expense.amount)}</td><td className="px-5 py-4">{expense.receiptName ? <span className="inline-flex max-w-[150px] items-center gap-1.5 truncate text-[11px] text-emerald-200"><FileImage className="h-3.5 w-3.5 shrink-0" />{expense.receiptName}</span> : <span className="text-[11px] text-amber-200">Хавсраагүй</span>}</td></tr>)}</tbody></table></div>{/* Mobile Card List */}<div className="grid gap-3 p-4 md:hidden">{expenses.map((expense) => <div key={expense.id} onClick={() => setSelectedExpense(expense)} className="cursor-pointer rounded-xl border border-white/8 bg-black/15 p-4 flex flex-col gap-2"><div className="flex items-center justify-between"><b className="text-cream text-xs">{expense.title}</b><Badge tone="neutral">{expense.category}</Badge></div><div className="flex items-center justify-between text-xs text-sand-400"><div><small className="block text-[10px] text-sand-500">{expense.id} · {expense.paymentMethod}</small><span>{expense.date}</span></div><div className="text-right"><b className="block text-cream">{formatMnt(expense.amount)}</b>{expense.receiptName ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200"><FileImage className="h-3 w-3" />Баримттай</span> : <span className="text-[10px] text-amber-200">Баримтгүй</span>}</div></div></div>)}</div></CardContent></Card>
        <Card><CardHeader><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">CATEGORY BREAKDOWN</p><h2 className="mt-1 font-serif text-xl text-cream">Ангиллаар</h2></div></CardHeader><CardContent className="space-y-4">{expensesByCategory.map(({ category, total: categoryTotal }) => <div key={category}><div className="flex items-center justify-between gap-3 text-xs"><span className="text-sand-300">{category}</span><b className="text-cream">{formatMnt(categoryTotal)}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-sand" style={{ width: `${Math.max(6, (categoryTotal / total) * 100)}%` }} /></div></div>)}</CardContent></Card></div>

      {isCreateOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm"><form onSubmit={saveExpense} className="my-5 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">FR-7.1 · NEW EXPENSE</p><h2 className="mt-2 font-serif text-2xl text-cream">Зарлага бүртгэх</h2><p className="mt-1 text-xs text-sand-400">Баримтын зураг эсвэл PDF-ийг хавсаргаад, ангиллыг нь сонгоно уу.</p></div><button type="button" onClick={resetDialog} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-sand-200">Зарлагын нэр<Input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2" placeholder="Жишээ: Лифтний засвар" /></label><label className="text-xs font-semibold text-sand-200">Огноо<Input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="mt-2" /></label><label className="text-xs font-semibold text-sand-200">Ангилал<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-cream outline-none focus:border-sand/55">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-xs font-semibold text-sand-200">Дүн<Input required type="number" min="1" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="mt-2" placeholder="480000" /></label><label className="text-xs font-semibold text-sand-200 sm:col-span-2">Төлбөрийн суваг<select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-cream outline-none focus:border-sand/55"><option>Банкны шилжүүлэг</option><option>Бэлэн мөнгө</option><option>Карт / ПОС</option></select></label></div>
        <label className="mt-4 block text-xs font-semibold text-sand-200">Тайлбар<Input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="mt-2" placeholder="Нэмэлт тайлбар (сонголтоор)" /></label>
        <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/15 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand/10 text-sand"><ImagePlus className="h-4 w-4" /></span><div className="min-w-0"><b className="block truncate text-xs text-cream">{receiptFile?.name ?? 'Баримтын зураг / PDF хавсаргах'}</b><p className="mt-1 text-[10px] text-sand-500">JPG, PNG эсвэл PDF · local preview</p></div></div><input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleReceiptChange(event.target.files?.[0])} /><Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>{receiptFile ? 'Солих' : 'Файл сонгох'}</Button></div>{previewUrl && <img src={previewUrl} alt="Баримтын урьдчилсан харагдац" className="mt-4 max-h-44 w-full rounded-lg border border-white/10 object-contain" />}{receiptFile && <button type="button" onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setReceiptFile(null); setPreviewUrl(null); }} className="mt-3 inline-flex items-center gap-1 text-[11px] text-sand-400 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" />Хавсралтыг арилгах</button>}</div>
        <div className="mt-7 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={resetDialog}>Болих</Button><Button type="submit"><CheckCircle2 className="h-4 w-4" />Зарлага хадгалах</Button></div>
      </form></div>}

      {selectedExpense && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={() => setSelectedExpense(null)}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">EXPENSE DETAIL</p><h2 className="mt-2 font-serif text-2xl text-cream">{selectedExpense.title}</h2><p className="mt-1 text-xs text-sand-400">{selectedExpense.id}</p></div><button type="button" onClick={() => setSelectedExpense(null)} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-3 text-sm">{[['Ангилал', selectedExpense.category], ['Огноо', selectedExpense.date], ['Дүн', formatMnt(selectedExpense.amount)], ['Төлбөрийн суваг', selectedExpense.paymentMethod], ['Баримт', selectedExpense.receiptName ?? 'Хавсраагүй']].map(([label, value]) => <div key={label} className="flex justify-between gap-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3"><span className="text-sand-400">{label}</span><b className="text-right text-cream">{value}</b></div>)}</div><div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setSelectedExpense(null)}>Хаах</Button><Button variant="danger" onClick={() => setExpenseToDelete(selectedExpense)}><Trash2 className="h-4 w-4" />Устгах</Button></div></div></div>}
      <ConfirmDialog open={Boolean(expenseToDelete)} title="Зарлага устгах уу?" description="Энэ бүртгэл болон холбогдох баримтын мэдээлэл буцаах боломжгүй устна." confirmLabel="Устгах" onCancel={() => setExpenseToDelete(null)} onConfirm={() => { if (expenseToDelete) deleteExpense(expenseToDelete); setExpenseToDelete(null); }} />
      </section>
    </PageStateWrapper>
  );
}
