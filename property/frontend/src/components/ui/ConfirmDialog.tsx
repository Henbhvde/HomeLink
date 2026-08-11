import Button from './Button';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, title, description, confirmLabel = 'Үргэлжлүүлэх', onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-sm rounded-2xl border border-red-300/20 bg-[#171614] p-6 text-cream shadow-2xl">
        <h2 id="confirm-title" className="font-serif text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-sand-400">{description}</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={onCancel}>Болих</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></div>
      </div>
    </div>
  );
}
