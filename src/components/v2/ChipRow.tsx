import { ReactNode } from 'react';

interface ChipRowProps {
  children: ReactNode;
  className?: string;
}

export function ChipRow({ children, className = '' }: ChipRowProps) {
  return (
    <div className={`flex flex-wrap gap-2 min-h-[44px] items-center ${className}`}>
      {children}
    </div>
  );
}
