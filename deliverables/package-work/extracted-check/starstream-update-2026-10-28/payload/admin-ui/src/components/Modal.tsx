import React from "react";

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  className = "",
  subtitle,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  subtitle?: string;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row">
          <div>
            <div className="h1">{title}</div>
            <div className="small">{subtitle || <>Press <span className="kbd">Esc</span> to close</>}</div>
          </div>
          <div className="spacer" />
          <button className="btn ghost" type="button" aria-label="Close dialog" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
        {footer ? <div className="row" style={{ marginTop: 14 }}>{footer}</div> : null}
      </div>
    </div>
  );
}
