import React from 'react';

const COLORS = [
  'bg-indigo-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-violet-600 text-white',
  'bg-cyan-600 text-white',
];

export default function Avatar({
  name = 'User',
  size = 'md',
  className = '',
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Deterministic color selection
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % COLORS.length;
  const colorClass = COLORS[colorIndex];

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-xl font-bold',
  };

  return (
    <div
      className={`
        inline-flex items-center justify-center rounded-full shrink-0 select-none shadow-sm
        ${colorClass}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

