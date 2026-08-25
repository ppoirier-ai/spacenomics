import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminPath } from '@/lib/paths';
import { isAdminEmail } from '@/lib/admin';

/**
 * Auth + role enforcement.
 * - Public: /opportunities, /auth/*, /api/public-briefs, /api/cron/*
 * - Signed-out users hitting anything else are sent to /auth/login?next=...
 * - Admin-only (brief lifecycle + admin console): /, /briefs/*, /calendar, /admin, /api/admin/*
 * - Customers are redirected to /library from admin-only paths.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const role = (user?.app_metadata?.role as string | undefined) ?? null;
  const isAdmin = role === 'admin' || isAdminEmail(user?.email);

  // Public paths (no session required)
  const isPublic = [
    '/',
    '/opportunities',
    '/preview',
    '/auth/login',
    '/auth/callback',
    '/api/public-briefs',
    '/api/cron',
    // Stripe webhook: Stripe POSTs here with no user session, so it must be
    // reachable without auth. Signature verification happens in the handler.
    '/api/webhooks',
  ].some((p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)));

  if (isPublic) {
    // Already signed in? Skip the login page.
    if (pathname === '/auth/login' && user) {
      const dest = isAdmin ? '/dashboard' : '/opportunities';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return supabaseResponse;
  }

  // Everything else requires a session
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  // Admin-only paths (shared list — includes the protected API routes as
  // defense-in-depth in front of the route-level checks).
  if (isAdminPath(pathname) && !isAdmin) {
    return NextResponse.redirect(new URL('/opportunities', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
};
