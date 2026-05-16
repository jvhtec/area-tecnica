import React from 'react';

export const AlienShell: React.FC<{
  title: string;
  kind?: 'standard' | 'critical' | 'env' | 'tracker';
  children: React.ReactNode;
}> = ({ title, kind = 'standard', children }) => {
  const headerCls = kind === 'critical' ? 'bg-red-400' : kind === 'env' ? 'bg-blue-400' : kind === 'tracker' ? 'bg-green-400' : 'bg-amber-400';
  return (
    <div className="bg-black border border-amber-400 h-full overflow-hidden font-mono">
      <div className={`${headerCls} text-black px-3 py-1 text-sm font-bold tracking-wider uppercase`}>{title}</div>
      <div className="p-3 text-amber-300 text-xs overflow-auto">{children}</div>
    </div>
  );
};

