'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const nav = [
  { href: '/dashboard',   label: 'Dashboard',    icon: '▦' },
  { href: '/agents',      label: 'Agents',        icon: '⬡' },
  { href: '/deployments', label: 'Deployments',   icon: '⚡' },
  { href: '/tools',       label: 'Tools',         icon: '⚙' },
  { href: '/playground',  label: 'Playground',    icon: '▶' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-violet-500/30">
            OS
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">AgentOS</div>
            <div className="text-gray-500 text-[10px] mt-0.5 leading-none">Control Plane</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-2">
          Platform
        </div>
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
            >
              <span className="text-base leading-none w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 space-y-3.5">
        <ThemeToggle />
        <div className="text-[10px] text-gray-600">
          AgentOS v1.0 · <span className="text-emerald-500">●</span> Operational
        </div>
      </div>
    </aside>
  );
}
