'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/today', label: 'Сегодня', icon: '◉' },
  { href: '/add', label: 'Добавить', icon: '＋' },
  { href: '/calendar', label: 'Календарь', icon: '📅' },
  { href: '/settings', label: 'Настройки', icon: '⚙' }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[460px] px-4 pb-4">
      <div className="flex items-center justify-between rounded-3xl border border-white/70 bg-white/88 px-3 py-2 shadow-soft backdrop-blur-xl">
        {LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-w-[80px] flex-1 flex-col items-center rounded-2xl px-2 py-2 text-xs transition-all duration-200 ease-ios ${
                isActive
                  ? 'bg-accent text-white shadow-soft'
                  : 'text-subtext hover:bg-slate-100/80 hover:text-text'
              }`}
            >
              <span className="text-base leading-none">{link.icon}</span>
              <span className="mt-1 font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
