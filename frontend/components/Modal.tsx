"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[calc(100vh-2rem)] w-full ${widthClassName} overflow-y-auto rounded-2xl bg-white p-6 shadow-lg`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-slate-400 transition hover:text-slate-600"
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
