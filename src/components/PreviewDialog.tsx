import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from '../Icon';
import './preview-dialog.css';

/** Shared console forms. Header/footer remain outside the scrollable body. */
export default function PreviewDialog({ title, description, children, footer, onClose, busy }: { title: string; description?: string; children: ReactNode; footer: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="preview-dialog" aria-labelledby="preview-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2 id="preview-dialog-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="关闭弹窗" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></header>
    <div className="preview-dialog-body">{children}</div><footer>{footer}</footer>
  </dialog>;
}
