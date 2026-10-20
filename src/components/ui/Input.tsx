import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id: idProp, ...props }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
            error ? "border-red-400 focus:outline-red-500" : "border-slate-300"
          } ${className}`}
          {...props}
        />
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id: idProp, ...props }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          aria-invalid={!!error}
          className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-2 focus:outline-brand-500 ${error ? "border-red-400" : "border-slate-300"} ${className}`}
          rows={4}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", id: idProp, ...props }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          aria-invalid={!!error}
          className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-2 focus:outline-brand-500 ${error ? "border-red-400" : "border-slate-300"} ${className}`}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
