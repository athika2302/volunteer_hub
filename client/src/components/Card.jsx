import React from 'react';

export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'p-5 sm:p-6',
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-900 
        rounded-card shadow-card 
        border border-slate-200/80 dark:border-slate-800 
        ${padding}
        ${hoverable ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 hover:shadow-md active:scale-[0.99]' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

