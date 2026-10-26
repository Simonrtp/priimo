import { after, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  GOOGLE_CONTACTS_JETON_COOKIE,
  GOOGLE_CONTACTS_LECTURE_PATH,
  LectureGoogleError,
  lireContactsGoogle,
  ouvrirJeton,
  rendreJeton,
} from '@/lib/contacts/google-contacts';
import { GOOGLE_COLONNES, personneVersValeurs } from '@/lib/import/google-contacts';
import { isBlankRow } from '@/lib/import/normalize';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Lit une fois les contacts Google de l'agent, rend l'accès, et renvoie un
 * tableau prêt pour l'aperçu d'import. Rien n'est écrit ici.
 */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const jar = await cookies();
  const jeton = ouvrirJeton(jar.get(GOOGLE_CONTACTS_JETON_COOKIE)?.value);
  jar.set(GOOGLE_CONTACTS_JETON_COOKIE, '', { path: GOOGLE_CONTACTS_LECTURE_PATH, maxAge: 0 });
  if (!jeton) {
    return NextResponse.json(
      { error: 'L’accès à Google a expiré. Reconnectez Google Contacts.' },
      { status: 410 },
    );
  }

  try {
    const personnes = await lireContactsGoogle(jeton);
    const rows = personnes
      .map((p) => personneVersValeurs(p))
      .filter((values) => !isBlankRow(Object.values(values)))
      .map((values, index) => ({ line: index + 1, values }));
    return NextResponse.json({ headers: [...GOOGLE_COLONNES], rows });
  } catch (err) {
    console.error('[google-contacts] lecture', err instanceof Error ? err.message : err);
    const raison = err instanceof LectureGoogleError ? err.raison : 'api';
    const message =
      raison === 'expire'
        ? 'L’accès à Google a expiré. Reconnectez Google Contacts.'
        : 'Google n’a pas pu fournir vos contacts. Réessayez dans un instant.';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    after(() => rendreJeton(jeton));
  }
}
