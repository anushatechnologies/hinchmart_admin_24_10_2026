// Reusable modal shell for create/edit flows in the Delivery Pricing module (V41).
// The owning page renders the form content inside the modal.

import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DeliveryModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  submitLabel = "Save",
  loading = false,
  confirmLabel = "Confirm",
  variant = "default",
  showCancel = true,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form submit is handled by the owning page via onSubmit in the form element.
  };

  return (
    <div
      className="modal-overlay delivery-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`delivery-modal delivery-modal-${variant || "default"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delivery-modal-header">
          <div className="delivery-modal-title-row">
            <h2 className="delivery-modal-title">{title}</h2>
            {subtitle && <span className="delivery-modal-subtitle">{subtitle}</span>}
          </div>
          <button
            type="button"
            className="delivery-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form className="delivery-modal-body" onSubmit={handleSubmit}>
          {children}
        </form>

        <div className="delivery-modal-footer">
          {showCancel && (
            <button
              type="button"
              className="delivery-modal-button delivery-modal-button-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="delivery-modal-button delivery-modal-button-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="delivery-modal-spinner" />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
