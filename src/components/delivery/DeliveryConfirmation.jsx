// Reusable destructive-action confirmation dialog for the Delivery Pricing module (V41).

import { X, AlertTriangle } from "lucide-react";

export default function DeliveryConfirmation({
  isOpen,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay delivery-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="delivery-modal delivery-modal-danger" onClick={(e) => e.stopPropagation()}>
        <div className="delivery-modal-header">
          <div className="delivery-modal-title-row">
            <span className="delivery-modal-alert-icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="delivery-modal-title">{title}</h2>
          </div>
        </div>
        <div className="delivery-modal-body">
          <p className="delivery-modal-message">{message}</p>
        </div>
        <div className="delivery-modal-footer">
          <button
            type="button"
            className="delivery-modal-button delivery-modal-button-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="delivery-modal-button delivery-modal-button-danger"
            onClick={onConfirm}
            disabled={!onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
