import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  number: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function Section({
  eyebrow,
  number,
  title,
  subtitle,
  children,
  action,
  className = '',
}: Props) {
  return (
    <section className={`pt-16 lg:pt-24 ${className}`}>
      <div className="rule-thick" />
      <div className="grid grid-cols-12 gap-8 pt-6">
        <div className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-muted-2">
                № {number}
              </span>
              <span className="eyebrow !before:hidden">
                <span className="ml-0">{eyebrow}</span>
              </span>
            </div>
            <h2 className="font-display text-[2.25rem] lg:text-[2.6rem] leading-[1.02] tracking-tight mt-3 text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="font-display italic text-[1.15rem] leading-snug text-muted-2 mt-2">
                {subtitle}
              </p>
            )}
            {action && <div className="mt-5">{action}</div>}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-9">{children}</div>
      </div>
    </section>
  );
}
