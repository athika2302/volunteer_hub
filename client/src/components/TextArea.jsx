import React from 'react';

export default function TextArea({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  rows = 3,
  required = false,
  disabled = false,
  className = '',
  ...props
}) {
  const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={areaId}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <textarea
        id={areaId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={`
          w-full rounded-btn text-sm p-3.5
          bg-white dark:bg-slate-900 
          text-slate-900 dark:text-slate-100 
          border transition-colors duration-150
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600
          disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed
          ${error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'}
        `}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
}

