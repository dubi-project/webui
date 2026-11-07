import { useEffect, useRef, useState } from 'react';

export default function useDrawer(onClose: () => void) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const closeRequested = useRef(false);
  const finished = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const element = dialog.current!;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer.current);
      element.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);

  function finishClose() {
    if (!closeRequested.current || finished.current) return;
    finished.current = true;
    window.clearTimeout(timer.current);
    onCloseRef.current();
  }
  function requestClose() {
    if (closeRequested.current) return;
    closeRequested.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
    setClosing(true);
    // Ensure dismissal still completes when animations are disabled or interrupted.
    timer.current = window.setTimeout(finishClose, 280);
  }
  function onBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
  }
  return { dialog, closing, requestClose, onBackdropClick, onAnimationEnd: (event: React.AnimationEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'drawer-out') finishClose();
  } };
}
