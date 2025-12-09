import React, { useEffect, useRef } from "react";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
};

const sizeMap: Record<ModalSize, string> = {
  sm: "400px",
  md: "500px",
  lg: "640px",
};

export const Modal: React.FC<ModalProps> = ({ 
  open, 
  onClose, 
  title, 
  description,
  children, 
  footer,
  size = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
      
      // Focus trap
      modalRef.current?.focus();
    }
    
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="pr-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        ref={modalRef}
        className="pr-modal"
        style={{ maxWidth: sizeMap[size] }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {title && (
          <div className="pr-modal__header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
              <div>
                <h2 id="modal-title" className="pr-modal__title">{title}</h2>
                {description && (
                  <p style={{ 
                    margin: "var(--space-1) 0 0", 
                    fontSize: "var(--font-body-sm)", 
        color: "var(--app-color-text-secondary)" 
                  }}>
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "var(--space-1)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--app-color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color var(--motion-fast)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--app-color-text-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--app-color-text-muted)"}
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        <div className="pr-modal__body">
          {children}
        </div>
        
        {footer && (
          <div className="pr-modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
