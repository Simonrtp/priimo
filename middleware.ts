import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import { resolveActiveAgencyId, resolveActiveRole } from '@/lib/auth/active-agency';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

const PUBLIC_ROUTES = new Set(['/', '/login', '/invite', '/cgu']);
const PUBLIC_API_PREFIXES = ['/api/beta'];

async function getDirectorOnboardingState(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<{ isDirector: boolean; needsOnboarding: boolean }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_agency_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { isDirector: false, needsOnboarding: false };
  }

  const { data: membershipRows } = await supabase
    .from('profile_agencies')
    .select('agency_id, role')
    .eq('profile_id', userId);

  const memberships = membershipRows ?? [];
  const activeAgencyId = resolveActiveAgencyId(profile, memberships);
  const activeRole = activeAgencyId ? resolveActiveRole(memberships, activeAgencyId) : null;

  if (activeRole !== 'directeur' || !activeAgencyId) {
    return { isDirector: false, needsOnboarding: false };
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select(
      'address, codes_postaux',
    )
    .eq('id', activeAgencyId)
    .maybeSingle();

  return {
    isDirector: true,
    needsOnboarding: agencyNeedsOnboarding(agency),
  };
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

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

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_ROUTES.has(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!user && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    const onboardingState =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/onboarding') ||
      pathname === '/login' ||
      pathname === '/signup'
        ? await getDirectorOnboardingState(supabase, user.id)
        : { isDirector: false, needsOnboarding: false };

    if (onboardingState.isDirector && onboardingState.needsOnboarding) {
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } else if (pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname === '/login' || pathname === '/signup') {
      const target = onboardingState.isDirector && onboardingState.needsOnboarding
        ? '/onboarding'
        : '/dashboard';
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  void isPublic;

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.gif|.*\\.ico).*)',
  ],
};
