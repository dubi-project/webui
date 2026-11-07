import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';
import './toast.css';

type Tone = 'success' | 'error' | 'warning' | 'info';
type Message = { id: number; tone: Tone; text: string };
let current: Message | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
function publish(message: Message | null) { current = message; listeners.forEach(listener => listener()); }
function show(tone: Tone, text: string) { if (text.trim()) publish({ id: ++sequence, tone, text }); }
/** Transient operation feedback; never use for field validation or cluster events. */
export const toast = {
  success: (text: string) => show('success', text),
  error: (text: string) => show('error', text),
  warning: (text: string) => show('warning', text),
  info: (text: string) => show('info', text),
  dismiss: () => publish(null),
};
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const titles: Record<Tone, string> = { success: '操作成功', error: '操作失败', warning: '请注意', info: '提示' };
function ToastCard({ message }: { message: Message }) {
  const element = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(message.tone === 'error' ? Infinity : message.tone === 'warning' ? 6500 : 4500);
  useEffect(() => {
    const node = element.current!;
    if ('showPopover' in node && node.isConnected) { try { node.showPopover(); } catch { /* A closing dialog is being removed; the viewport will rehost. */ } }
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); if ('hidePopover' in node && node.matches(':popover-open')) node.hidePopover(); };
  }, []);
  useEffect(() => {
    if (closing || hovered || focused || hidden || !Number.isFinite(remaining.current)) return;
    const start = performance.now();
    const timer = window.setTimeout(() => setClosing(true), Math.max(0, remaining.current));
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - start)); };
  }, [closing, hovered, focused, hidden]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => { if (current?.id === message.id) publish(null); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [closing, message.id]);
  return <div ref={element} popover={'showPopover' in HTMLElement.prototype ? 'manual' : undefined} className={`app-toast toast-${message.tone}${closing ? ' is-closing' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <div className="app-toast-content"><span className="app-toast-symbol"><Icon name={message.tone === 'success' ? 'check' : message.tone === 'info' ? 'bell' : 'alert'} size={19}/></span><div className="app-toast-copy" role={message.tone === 'error' ? 'alert' : 'status'} aria-atomic="true"><strong>{titles[message.tone]}</strong><p>{message.text}</p></div><button type="button" className="app-toast-close" aria-label="关闭操作提示" onClick={() => setClosing(true)}><Icon name="close" size={17}/></button></div>
  </div>;
}
/** One viewport for the application; newest result replaces the preceding one. */
export default function ToastViewport() {
  const message = useSyncExternalStore(subscribe, () => current);
  const [host, setHost] = useState<HTMLElement>(document.body);
  useEffect(() => {
    // Portaling into the active dialog keeps close/pause controls interactive
    // while showModal makes the rest of the document inert. The manual popover
    // places feedback above the dialog without moving focus or adding a backdrop.
    function updateHost() {
      const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
      setHost(dialogs.at(-1) ?? document.body);
    }
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true });
    window.addEventListener('hashchange', toast.dismiss);
    return () => { observer.disconnect(); window.removeEventListener('hashchange', toast.dismiss); };
  }, []);
  return message ? createPortal(<ToastCard key={message.id} message={message}/>, host) : null;
}
