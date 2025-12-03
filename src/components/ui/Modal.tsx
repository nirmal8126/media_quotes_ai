"use client";

import { ReactNode, useEffect } from 'react';

type ModalProps = {
  title?: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export default function Modal({ title, description, open, onClose, children, widthClass = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className={`w-full ${widthClass} rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
            {description && <p className="text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
