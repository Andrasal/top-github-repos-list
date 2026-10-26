import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { SOURCES } from '../lib/sources';

export function Card({ title, icon, children, actions, id }: { title: string; icon?: string; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-40 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/60">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** Numeric input whose stored value is SI; `toDisplay`/`fromDisplay` convert at the boundary (SPEC §12). */
export function NumberField({
  label, value, onChange, unit, step = 0.1, min = 0, max, toDisplay = (v) => v, fromDisplay = (v) => v, decimals = 3, hint, className = '',
}: {
  label?: string; value: number; onChange: (si: number) => void; unit?: string; step?: number; min?: number; max?: number;
  toDisplay?: (si: number) => number; fromDisplay?: (d: number) => number; decimals?: number; hint?: ReactNode; className?: string;
}) {
  const id = useId();
  const fmt = (v: number) => String(Number(toDisplay(v).toFixed(decimals)));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, toDisplay]);
  return (
    <label htmlFor={id} className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && (
        <span className="label flex items-center gap-1">
          {label}
          {hint && <Tip>{hint}</Tip>}
        </span>
      )}
      <span className="flex items-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="tabular w-full min-w-0"
          value={text}
          step={step}
          min={min}
          max={max}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setText(fmt(value));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const d = parseFloat(e.target.value);
            if (Number.isFinite(d) && d >= min && (max == null || d <= max)) onChange(fromDisplay(d));
          }}
        />
        {unit && <span className="w-6 shrink-0 text-xs text-stone-500">{unit}</span>}
      </span>
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options, className = '' }: {
  label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && <span className="label">{label}</span>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full min-w-0">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Accessible tooltip: shows on hover and on keyboard focus / tap. */
export function Tip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600 dark:bg-stone-700 dark:text-stone-200"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-5 z-30 w-64 -translate-x-1/2 rounded-md bg-stone-900 p-2 text-xs font-normal leading-snug text-stone-100 shadow-lg dark:bg-stone-100 dark:text-stone-900">
          {children}
        </span>
      )}
    </span>
  );
}

export function Stat({ label, value, sub, tone = 'default', action }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'accent'; action?: ReactNode }) {
  return (
    <div className={`rounded-lg p-3 ${tone === 'accent' ? 'bg-honey-100 dark:bg-honey-900/30' : 'bg-stone-100 dark:bg-stone-800/60'}`}>
      <div className="label flex items-center justify-between gap-1">{label}{action}</div>
      <div className="tabular mt-1 whitespace-nowrap text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-stone-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Cite({ ids }: { ids: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => {
        const s = SOURCES[id];
        if (!s) return null;
        return (
          <span key={id} title={s.citation} className="rounded bg-stone-200/70 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            {s.short}
          </span>
        );
      })}
    </span>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="btn-ghost h-8 w-8 justify-center p-0 text-stone-400 hover:text-red-600">
      ✕
    </button>
  );
}
