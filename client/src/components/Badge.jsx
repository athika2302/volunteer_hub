import React from 'react';

export default function Badge({
  status,
  label,
  size = 'md',
  className = '',
}) {
  const normStatus = (status || '').toLowerCase();

  const configs = {
    confirmed: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      text: 'Confirmed',
    },
    waitlisted: {
      bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      text: 'Waitlisted',
    },
    attended: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      dot: 'bg-indigo-500',
      text: 'Attended',
    },
    'no-show': {
      bg: 'bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800/80',
      dot: 'bg-rose-500',
      text: 'No-show',
    },
    cancelled: {
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
      text: 'Cancelled',
    },
    paid: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      text: 'Paid',
    },
    pending: {
      bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      text: 'Pending',
    },
    approved: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      text: 'Approved',
    },
  };

  const current = configs[normStatus] || {
    bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    text: label || status || 'Unknown',
  };

  const displayText = label || current.text;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${current.bg}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />
      <span>{displayText}</span>
    </span>
  );
}

