'use client';

import { useEffect, useState } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { useSupabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import PageTransition from '@/components/page-transition';
import { Analytics } from '@vercel/analytics/react';
import {
  LayoutDashboard, FilePlus, CalendarDays, LogOut, Store, ShieldCheck, Settings,
  Sun, Moon,
} from 'lucide-react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-var',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display-var',
  display: 'swap',
});

/** Apply the saved theme before first paint (defaults to dark). */
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light') { document.documentElement.classList.remove('dark'); }
  else { document.documentElement.classList.add('dark'); }
} catch (e) { document.documentElement.classList.add('dark'); }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const router = useRouter();
  const { user, role, loading } = useRole();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    let active = true;
    try {
      const t = localStorage.getItem('theme');
      // Defer the setState off the synchronous effect body
      // (react-hooks/set-state-in-effect) — same read, no cascading render.
      queueMicrotask(() => {
        if (active) setTheme(t === 'light' ? 'light' : 'dark');
      });
    } catch {
      /* keep dark */
    }
    return () => { active = false; };
  }, []);

  const toggleTheme = () => {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* noop */
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push('/auth/login');
  };

  const isAdmin = role === 'admin';
  const signedIn = !!user;

  const navLinks = !signedIn
    ? [{ href: '/opportunities', label: 'Opportunities', icon: Store }]
    : isAdmin
      ? [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/opportunities', label: 'Opportunities', icon: Store },
          { href: '/briefs/new', label: 'New Brief', icon: FilePlus },
          { href: '/calendar', label: 'Calendar', icon: CalendarDays },
          { href: '/admin', label: 'Admin Console', icon: ShieldCheck },
        ]
      : [
          // Customers: purchase + access everything via the marketplace
          { href: '/opportunities', label: 'Opportunities', icon: Store },
        ];

  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans min-h-screen bg-background text-foreground antialiased flex flex-col`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Ambient deep-space backdrop (fixed, behind everything) */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 cosmic-stars opacity-40" />
          <div className="absolute -top-48 -right-48 w-[560px] h-[560px] rounded-full nebula nebula-indigo opacity-70" />
          <div className="absolute bottom-0 -left-56 w-[640px] h-[640px] rounded-full nebula nebula-teal opacity-60" />
        </div>

        {/* Orbital accent bar */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#2EC4C6]/70 to-transparent" />

        <header className="border-b border-[var(--hairline)] bg-[var(--header-bg)] backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[124px]">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center group" aria-label="Spacenomics Home">
                  <img
                    src="/brand/logo-white.webp"
                    alt="SPACENOMICS"
                    className="hidden dark:block w-[200px] h-[112px] object-contain transition-opacity duration-300 group-hover:opacity-80"
                    width={200}
                    height={112}
                    loading="eager"
                  />
                  <img
                    src="/brand/logo-navy.webp"
                    alt="SPACENOMICS"
                    className="block dark:hidden w-[200px] h-[112px] object-contain transition-opacity duration-300 group-hover:opacity-80"
                    width={200}
                    height={112}
                    loading="eager"
                  />
                </Link>
                <nav className="hidden md:flex items-center gap-1">
                  {navLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all duration-300 smooth-ease"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="text-gray-500 hover:text-[#2EC4C6] hover:bg-white/5 h-8 w-8 p-0 rounded-lg"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                {!loading && !signedIn && (
                  <Link href="/auth/login">
                    <Button className="bg-[#2EC4C6] hover:bg-[#28B0B2] text-black font-medium h-8 px-3.5 text-xs rounded-lg">
                      Sign In
                    </Button>
                  </Link>
                )}
                {signedIn && (
                  <>
                    <span className="text-xs text-gray-500 hidden sm:inline max-w-[160px] truncate">{user?.email}</span>
                    {isAdmin && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-[#2EC4C6]/10 text-[#2EC4C6] border-0 rounded-full hidden sm:inline-flex">
                        Admin
                      </Badge>
                    )}
                    <Link href="/settings">
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white hover:bg-white/5 h-8 w-8 p-0">
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="text-gray-500 hover:text-white hover:bg-white/5 h-8 px-2.5"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1.5" />
                      <span className="text-xs">Sign Out</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Mobile nav */}
            <nav className="flex md:hidden items-center gap-1 pb-2.5 overflow-x-auto">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all whitespace-nowrap"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="border-t border-[var(--hairline)] mt-auto py-6">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-[11px] text-gray-500 tracking-wide">
              Prepared by Smooth Capital LLC &bull; Spacenomics Venture Briefs
            </p>
            <p className="text-[9px] text-gray-700/60 mt-1.5 max-w-lg mx-auto">
              Educational and commercial intelligence only. Not investment advice. Not an offer to sell securities.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
