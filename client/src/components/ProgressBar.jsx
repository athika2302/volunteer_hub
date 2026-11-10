import React from 'react';

export default function ProgressBar({
  filled = 0,
  capacity = 1,
  showLabel = true,
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((filled / capacity) * 100)));
  const isFull = filled >= capacity;
  const isNearlyFull = percentage >= 80 && !isFull;

  // Dynamic bar colors based on capacity fill
  const barColor = isFull
    ? 'bg-rose-500'
    : isNearlyFull
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          <span>
            {filled} of {capacity} spots filled
          </span>
          <span className={isFull ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
            {isFull ? 'Full' : `${capacity - filled} left`}
          </span>
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

