import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { resolveActiveAgencyId, resolveActiveRole } from '@/lib/auth/active-agency';
import { deviceFromHints } from '@/lib/device';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

/** Routes marketing / légales : pas de getUser (latence). */
const SKIP_AUTH_PREFIXES = [
  '/blog',
  '/fonctionnalites',
  '/comparatifs',
  '/a-propos',
  '/cgu',
  '/confidentialite',
  '/politique-de-confidentialite',
  '/mentions-legales',
  '/estimation',
  '/avis',
  '/rapport',
  '/c',
  '/information',
  '/api/c',
  '/api/rapport',
  // Mot de passe oublié : la session se crée dans l'action, pas besoin de la lire avant.
  '/mot-de-passe',
];

const PUBLIC_EXACT = new Set(['/', '/login', '/invite', '/cgu', '/signup', '/inscription']);

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

  const skipAuth =
    pathname === '/' ||
    pathname === '/inscription' ||
    SKIP_AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Assets / APIs publiques : passer sans session refresh.
  if (
    skipAuth &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/admin') &&
    pathname !== '/login' &&
    pathname !== '/signup' &&
    pathname !== '/inscription' &&
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

  // getClaims vérifie la signature du jeton en local (clés ES256 en cache) et
  // ne rafraîchit la session qu'à son expiration. getUser interrogeait le
  // serveur d'auth à chaque requête, préchargements compris.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims.sub ? { id: claimsData.claims.sub } : null;

  if (
    !user &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/imprimer'))
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    // Le dashboard n'est pas contrôlé ici : son layout renvoie déjà le
    // directeur sans zone vers l'onboarding, avec le profil qu'il charge de
    // toute façon. Le refaire ici coûtait deux allers-retours de plus à chaque
    // navigation et à chaque préchargement.
    const needsOnboardingCheck =
      pathname.startsWith('/onboarding') || pathname === '/login' || pathname === '/signup';

    const onboardingState = needsOnboardingCheck
      ? await getDirectorOnboardingState(supabase, user.id)
      : { isDirector: false, needsOnboarding: false, canEnterDashboard: true };

    const resteEnOnboarding = onboardingState.isDirector && onboardingState.needsOnboarding;
    if (pathname.startsWith('/onboarding') && onboardingState.canEnterDashboard && !resteEnOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Uniquement si le profil est chargeable — sinon on laisse /login afficher
    // le formulaire (évite l’écran blanc login ↔ dashboard).
    if ((pathname === '/login' || pathname === '/signup') && onboardingState.canEnterDashboard) {
      const target = resteEnOnboarding ? '/onboarding' : '/dashboard';
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
