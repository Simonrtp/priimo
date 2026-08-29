import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { resolveActiveAgencyId, resolveActiveRole } from '@/lib/auth/active-agency';
import { deviceFromHints } from '@/lib/device';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { frameAncestorsFor, widgetPublicIdFromPath } from '@/lib/widget/frame-policy';

/** Routes marketing / légales : pas de getUser (latence). */
const SKIP_AUTH_PREFIXES = [
  '/blog',
  '/fonctionnalites',
  '/comparatifs',
  '/a-propos',
  '/cgu',
  '/confidentialite',
  '/mentions-legales',
  '/estimation',
  '/avis',
  '/e',
  '/embed',
];

/**
 * Le widget est la seule page du site destinée à être cadrée par un tiers.
 * Elle porte donc ses propres en-têtes : `frame-ancestors` calculé à partir de
 * la liste blanche de l'agence, et pas le X-Frame-Options: DENY du reste du
 * site (next.config.js exclut /e et /embed de la règle globale).
 */
const WIDGET_SECURITY_HEADERS: Array<[string, string]> = [
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-XSS-Protection', '0'],
];

async function widgetResponse(request: NextRequest, publicId: string) {
  const frameAncestors = await frameAncestorsFor(publicId);
  const response = NextResponse.next();
  for (const [key, value] of WIDGET_SECURITY_HEADERS) response.headers.set(key, value);
  response.headers.set('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  // Deux agences n'ont pas la même liste : le cache ne doit pas les confondre.
  response.headers.set('Cache-Control', 'private, no-store');
  void request;
  return response;
}

const PUBLIC_EXACT = new Set(['/', '/login', '/invite', '/cgu', '/signup']);

async function getDirectorOnboardingState(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<{ isDirector: boolean; needsOnboarding: boolean; canEnterDashboard: boolean }> {
  const [profileRes, membershipRes] = await Promise.all([
    supabase.from('profiles').select('active_agency_id').eq('id', userId).maybeSingle(),
    supabase.from('profile_agencies').select('agency_id, role').eq('profile_id', userId),
  ]);

  const profile = profileRes.data;
  const memberships = membershipRes.data ?? [];
  // Session auth OK mais profil / agence illisibles → ne pas renvoyer login↔dashboard.
  if (!profile || memberships.length === 0) {
    return { isDirector: false, needsOnboarding: false, canEnterDashboard: false };
  }

  const activeAgencyId = resolveActiveAgencyId(profile, memberships);
  const activeRole = activeAgencyId ? resolveActiveRole(memberships, activeAgencyId) : null;

  if (!activeAgencyId || !activeRole) {
    return { isDirector: false, needsOnboarding: false, canEnterDashboard: false };
  }

  if (activeRole !== 'directeur') {
    return { isDirector: false, needsOnboarding: false, canEnterDashboard: true };
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('address, codes_postaux')
    .eq('id', activeAgencyId)
    .maybeSingle();

  return {
    isDirector: true,
    needsOnboarding: agencyNeedsOnboarding(agency),
    canEnterDashboard: true,
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const widgetPublicId = widgetPublicIdFromPath(pathname);
  if (widgetPublicId) return widgetResponse(request, widgetPublicId);

  const skipAuth =
    pathname === '/' ||
    SKIP_AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Assets / APIs publiques : passer sans session refresh.
  if (
    skipAuth &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/admin') &&
    pathname !== '/login' &&
    pathname !== '/signup' &&
    pathname !== '/invite'
  ) {
    return NextResponse.next();
  }

  const device = deviceFromHints({
    ua: request.headers.get('user-agent') ?? '',
    chMobile: request.headers.get('sec-ch-ua-mobile'),
    cookie: request.headers.get('cookie'),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-device', device);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-device', device);
  response.headers.append('Vary', 'User-Agent');
  response.headers.append('Accept-CH', 'Sec-CH-UA-Mobile');
  response.headers.set('Critical-CH', 'Sec-CH-UA-Mobile');

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    const needsOnboardingCheck =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/onboarding') ||
      pathname === '/login' ||
      pathname === '/signup';

    const onboardingState = needsOnboardingCheck
      ? await getDirectorOnboardingState(supabase, user.id)
      : { isDirector: false, needsOnboarding: false, canEnterDashboard: true };

    if (onboardingState.isDirector && onboardingState.needsOnboarding) {
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } else if (pathname.startsWith('/onboarding') && onboardingState.canEnterDashboard) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Uniquement si le profil est chargeable — sinon on laisse /login afficher
    // le formulaire (évite l’écran blanc login ↔ dashboard).
    if ((pathname === '/login' || pathname === '/signup') && onboardingState.canEnterDashboard) {
      const target =
        onboardingState.isDirector && onboardingState.needsOnboarding
          ? '/onboarding'
          : '/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  void PUBLIC_EXACT;

  return response;
}

export const config = {
  matcher: [
    /*
     * Auth / redirects only where needed — skip static assets.
     * Marketing pages still match but short-circuit without getUser above.
     * Les fichiers de la PWA sont exclus : le service worker les redemande
     * régulièrement et ils n'ont aucune raison de coûter un getUser().
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|mp4|webm|woff2?)$).*)',
  ],
};
