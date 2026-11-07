import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import './select.css';

export interface SelectOption { value: string; label: string }
interface Props {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

/** A compact single-select. Focus stays on the trigger while navigating options. */
export default function Select({ label, value, options, onChange, disabled = false, onLoadMore, loadingMore = false }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [active, setActive] = useState(0);
  const selected = options.findIndex(option => option.value === value);
  const open = position !== null && !disabled && options.length > 0;

  function popupPosition() {
    if (!trigger.current) return null;
    const rect = trigger.current.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return null;
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const desiredHeight = Math.min(options.length * 34 + 10, 250);
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const flip = below < desiredHeight && above > below;
    const maxHeight = Math.max(0, Math.min(desiredHeight, flip ? above : below));
    return { width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: flip ? rect.top - maxHeight - 6 : rect.bottom + 6, maxHeight };
  }
  function expand(index = selected < 0 ? 0 : selected) {
    if (disabled || !options.length || !trigger.current) return;
    setPosition(popupPosition());
    setActive(index);
    search.current = { text: '', time: 0 };
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setPosition(null);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setPosition(null);
    }
    function reposition(event: Event) {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) setPosition(popupPosition());
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, options.length]);
  useEffect(() => {
    // Scroll only the popup; scrollIntoView can unexpectedly move the
    // underlying page/dialog and shift the trigger while selecting an option.
    const container = popup.current;
    const option = document.getElementById(`${id}-${active}`);
    if (!open || !container || !option) return;
    const box = container.getBoundingClientRect();
    const item = option.getBoundingClientRect();
    if (item.top < box.top + 4) container.scrollTop -= box.top + 4 - item.top;
    else if (item.bottom > box.bottom - 4) container.scrollTop += item.bottom - box.bottom + 4;
  }, [open, active, id]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === 'Tab' || key === 'Escape') {
      if (key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); }
      setPosition(null);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault();
      if (!open) { expand(key === 'Home' ? 0 : key === 'End' ? options.length - 1 : selected < 0 ? 0 : selected); return; }
      if (key === 'Enter' || key === ' ') { choose(active); return; }
      if (key === 'ArrowDown' && active === options.length - 1 && onLoadMore) { if (!loadingMore) onLoadMore(); return; }
      setActive(current => key === 'Home' ? 0 : key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, current + (key === 'ArrowDown' ? 1 : -1))));
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const prefix = (now - search.current.time < 700 ? search.current.text : '') + key.toLowerCase();
      search.current = { text: prefix, time: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(prefix));
      if (index >= 0) { event.preventDefault(); if (!open) expand(index); else setActive(index); }
    }
  }

  return <div className="compact-select">
    <button ref={trigger} type="button" className="select-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined} aria-describedby={open && onLoadMore ? `${id}-more-hint` : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} onKeyDown={handleKey} onBlur={() => setPosition(null)} onClick={() => open ? setPosition(null) : expand()}>
      <span>{options[selected]?.label ?? '请选择'}</span>
      <svg className="select-chevron" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {open && createPortal(<div ref={popup} className="select-popup" style={position} onMouseDown={event => event.preventDefault()}><div id={id} role="listbox" aria-label={label} aria-busy={loadingMore}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} className={`select-option ${active === index ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>
        <span>{option.label}</span><svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ visibility: option.value === value ? 'visible' : 'hidden' }}><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>)}
    </div>{onLoadMore && <><span id={`${id}-more-hint`} className="sr-only">到达最后一项后按向下键加载更多。</span><button type="button" tabIndex={-1} className="select-load-more" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? '正在加载…' : '加载更多节点'}</button></>}
    </div>, trigger.current?.closest('dialog') ?? document.body)}
  </div>;
}
