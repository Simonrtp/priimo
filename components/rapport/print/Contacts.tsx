import { joindreSansVide } from '@/lib/rapport/identite';
import { memeContact, nomPersonne } from '@/lib/rapport/genere/format';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { Carte } from './Gabarit';

export function BlocAgence({ d }: { d: DossierRapport }) {
  const a = d.agence;
  const tel = memeContact(a.telephone, d.agent.telephone) ? null : a.telephone;
  const email = memeContact(a.email, d.agent.email) ? null : a.email;
  const ligne = joindreSansVide([a.adresse, tel, email, a.siteWeb], '\n');
  return (
    <Carte>
      {a.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.logoUrl} alt="" style={{ height: 28, maxWidth: 140, objectFit: 'contain', marginBottom: 8 }} />
      ) : null}
      {a.nomCommercial ? <p className="avis-valeur">{a.nomCommercial}</p> : null}
      {ligne ? (
        <p className="avis-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', whiteSpace: 'pre-line' }}>
          {ligne}
        </p>
      ) : null}
    </Carte>
  );
}

export function CarteAgent({ d }: { d: DossierRapport }) {
  const nom = nomPersonne(d.agent.nom);
  if (!nom && !d.agent.telephone && !d.agent.email && !d.agent.photoUrl) return null;
  const ligne = joindreSansVide([d.agent.telephone, d.agent.email]);
  return (
    <Carte>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {d.agent.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.agent.photoUrl}
            alt=""
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : nom ? (
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              width: 56,
              height: 56,
              borderRadius: '50%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(26, 42, 86,0.1)',
              fontWeight: 700,
            }}
          >
            {nom.slice(0, 1)}
          </span>
        ) : null}
        <div>
          {nom ? <p className="avis-valeur">{nom}</p> : null}
          {ligne ? (
            <p className="avis-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
              {ligne}
            </p>
          ) : null}
        </div>
      </div>
    </Carte>
  );
}
