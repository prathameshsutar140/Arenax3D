import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type AppRoute = 'home' | 'explore' | 'events' | 'tickets' | 'admin';

interface NavbarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenAuth: () => void;
}

export function ArenaXLogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arenaxGrad" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M18 3L32 10.5V25.5L18 33L4 25.5V10.5L18 3Z"
        stroke="url(#arenaxGrad)"
        strokeWidth="2.2"
        fill="rgba(15, 23, 42, 0.85)"
      />
      <ellipse cx="18" cy="18" rx="9" ry="5.5" stroke="#38BDF8" strokeWidth="1.6" />
      <path d="M12.5 11.5L23.5 24.5M23.5 11.5L12.5 24.5" stroke="url(#arenaxGrad)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar({ activeRoute, onNavigate, onOpenAuth }: NavbarProps) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ id: AppRoute; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'explore', label: 'Explore Stadium' },
    { id: 'events', label: 'Upcoming Events' },
    { id: 'tickets', label: 'My Tickets' },
    { id: 'admin', label: 'Admin' },
  ];

  const handleNav = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-800/80 bg-[#050814]/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Clean single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        >
          <ArenaXLogoMark className="h-7 w-7 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-100">
            ArenaX 3D
          </span>
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
          {navItems.map((item) => {
            const active = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                  active
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary auth action */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={logout}
              title={`Signed in as ${user.email}`}
              className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/60 hover:text-white whitespace-nowrap shrink-0"
            >
              {user.fullName.split(' ')[0]} · Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              Sign In / Register
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:text-white"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#070b1a] px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                activeRoute === item.id
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-800">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200"
              >
                Sign Out ({user.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth();
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
