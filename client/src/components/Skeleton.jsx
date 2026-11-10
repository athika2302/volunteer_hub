import React from 'react';

export default function Skeleton({
  variant = 'text',
  className = '',
  count = 1,
}) {
  const base = 'animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md';

  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    card: 'h-36 w-full rounded-card',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-11 w-28 rounded-btn',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${base} ${variants[variant] || variants.text} ${className}`}
        />
      ))}
    </>
  );
}

