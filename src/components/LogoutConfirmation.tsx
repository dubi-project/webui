import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function LogoutConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);

  return createPortal(<dialog ref={dialog} className="logout-confirmation" aria-labelledby="logout-title" aria-describedby="logout-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="logout-title">确认退出登录？</h2>
    <p id="logout-description">退出后，再次访问管理控制台需要重新登录。</p>
    <div className="logout-confirmation-actions">
      <button className="outline-button" autoFocus onClick={onCancel}>取消</button>
      <button className="confirm-logout-button" onClick={onConfirm}>退出登录</button>
    </div>
  </dialog>, document.body);
}
