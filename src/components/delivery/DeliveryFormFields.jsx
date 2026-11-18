// Reusable form field components for the Delivery Pricing module (V41).
// Follows the HinchMart Admin pattern: `.form-group` > label > control.

export function TextInput({ label, value, onChange, placeholder, type = "text", autoComplete, disabled, required, hint, id, className, ...props }) {
  return (
    <div className={`form-group ${className || ""}`}>
      {label && <label htmlFor={id}>{label}{required ? <span className="req-star">*</span> : null}</label>
      }
      <input
        id={id}
        type={type}
        value={value == null ? "" : value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        className="input-field"
        {...props}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function NumberInput({ label, value, onChange, placeholder, min, max, step, disabled, required, hint, id, className, ...props }) {
  return (
    <div className={`form-group ${className || ""}`}>
      {label && <label htmlFor={id}>{label}{required ? <span className="req-star">*</span> : null}</label>
      }
      <input
        id={id}
        type="number"
        value={value == null ? "" : value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        className="input-field"
        {...props}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 3, disabled, required, hint, id, className, ...props }) {
  return (
    <div className={`form-group ${className || ""}`}>
      {label && <label htmlFor={id}>{label}{required ? <span className="req-star">*</span> : null}</label>
      }
      <textarea
        id={id}
        value={value == null ? "" : value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className="input-field textarea-field"
        {...props}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function SelectInput({ label, value, onChange, options, placeholder = "Select an option", disabled, required, hint, id, className, ...props }) {
  return (
    <div className={`form-group ${className || ""}`}>
      {label && <label htmlFor={id}>{label}{required ? <span className="req-star">*</span> : null}</label>
      }
      <select
        id={id}
        value={value == null ? "" : value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="input-field select-field"
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function CheckInput({ label, checked, onChange, disabled, hint, id, className }) {
  return (
    <div className={`form-group form-group-checkbox ${className || ""}`}>
      <label htmlFor={id} className="check-label">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="check-input"
        />
        {label}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export default {
  TextInput,
  NumberInput,
  TextArea,
  SelectInput,
  CheckInput,
};
