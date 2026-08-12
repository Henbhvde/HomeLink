import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Modal from './Modal';

const roleCommands = {
  manager: [['Хяналтын самбар', '/manager'], ['Барилга, айл', '/manager/buildings'], ['Оршин суугчид', '/manager/residents'], ['Нэхэмжлэл', '/manager/billing'], ['Төлбөр', '/manager/payments'], ['Тоолуур', '/manager/meters'], ['Засвар үйлчилгээ', '/manager/maintenance'], ['Тайлан', '/manager/reports'], ['Тохиргоо', '/manager/settings']],
  accountant: [['Санхүүгийн самбар', '/accountant'], ['Нэхэмжлэл', '/accountant/billing'], ['Төлбөр', '/accountant/payments'], ['Зардал', '/accountant/expenses'], ['Тоолуур', '/accountant/meters']],
  resident: [['Миний нүүр', '/resident'], ['Төлбөр төлөх', '/resident/payments'], ['Үйлчилгээний хүсэлт', '/resident/services'], ['Зар мэдээ', '/resident/community']],
  staff: [['Ажлын даалгавар', '/staff']],
  super_admin: [['Платформ', '/platform'], ['Хүсэлтүүд', '/platform/requests'], ['Байгууллагууд', '/platform/tenants'], ['Орлого', '/platform/revenue'], ['Тохиргоо', '/platform/settings']],
} as const;

type CommandRole = keyof typeof roleCommands;
type Command = readonly [string, string];

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const commands: readonly Command[] = useMemo(() => {
    if (!user) return [['Нэвтрэх', '/login'], ['Үнийн мэдээлэл', '/pricing']] as const;
    return user.role === 'unassigned' ? [] : roleCommands[user.role as CommandRole];
  }, [user]);
  const results = commands.filter(([label]) => label.toLocaleLowerCase('mn').includes(query.trim().toLocaleLowerCase('mn')));

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((value) => !value); }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); else { setQuery(''); setActive(0); } }, [open]);
  useEffect(() => setActive(0), [query]);
  const select = (path: string) => { navigate(path); setOpen(false); };

  return <Modal open={open} onClose={() => setOpen(false)} title="Хурдан хайлт" description="Хуудас руу шууд очих · Ctrl/Cmd + K">
    <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-sand-500" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); } if (event.key === 'Enter' && results[active]) select(results[active][1]); }} placeholder="Хуудас хайх..." aria-label="Command хайлт" role="combobox" aria-expanded="true" className="h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-4 text-sm text-cream outline-none focus:border-sand/50 focus:ring-2 focus:ring-sand/20" /></div>
    <div className="mt-3 max-h-72 space-y-1 overflow-y-auto" role="listbox">{results.map(([label, path], index) => <button type="button" role="option" aria-selected={index === active} key={path} onMouseEnter={() => setActive(index)} onClick={() => select(path)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${index === active ? 'bg-sand/15 text-cream' : 'text-sand-300 hover:bg-white/5'}`}><span>{label}</span><span className="text-[10px] text-sand-500">↵</span></button>)}{!results.length && <p className="py-8 text-center text-sm text-sand-500">Илэрц олдсонгүй</p>}</div>
  </Modal>;
}
