/**
 * Import des contours de parcelles (cadastre Etalab) dans `parcelles_geo`.
 *
 *   npx tsx --require ./scripts/hors-next.cjs --env-file=.env.local scripts/import-parcelles-geo.ts [communes] [--ecrire]
 *
 * Sans `--ecrire` : essai à blanc (téléchargement, calculs, comptes). Communes
 * par défaut : 75111 (11ᵉ) et 75120 (20ᵉ). Réimporter remplace les contours.
 */
import { setDefaultResultOrder } from 'node:dns';
import { gunzipSync } from 'node:zlib';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';

type Position = [number, number];
type Feature = {
  id?: string;
  properties?: { id?: string; commune?: string };
  geometry?: { type: string; coordinates: unknown };
};

// Le stockage d'Etalab ne répond pas toujours en IPv6.
setDefaultResultOrder('ipv4first');

const SOURCE = (c: string) =>
  `https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/${c.slice(0, 2)}/${c}/cadastre-${c}-parcelles.json.gz`;

const arrondir = (p: number[]): Position => [Math.round(p[0]! * 1e6) / 1e6, Math.round(p[1]! * 1e6) / 1e6];

/** Centre de gravité de l'anneau extérieur (moyenne des sommets si dégénéré). */
function centre(anneau: Position[]): Position {
  let aire = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < anneau.length - 1; i += 1) {
    const [x0, y0] = anneau[i]!;
    const [x1, y1] = anneau[i + 1]!;
    const f = x0 * y1 - x1 * y0;
    aire += f;
    x += (x0 + x1) * f;
    y += (y0 + y1) * f;
  }
  if (Math.abs(aire) < 1e-14) {
    const n = anneau.length;
    return [anneau.reduce((s, p) => s + p[0], 0) / n, anneau.reduce((s, p) => s + p[1], 0) / n];
  }
  return [x / (3 * aire), y / (3 * aire)];
}

function ligne(f: Feature, commune: string) {
  const id = normalizeParcelleId(f.properties?.id ?? f.id ?? '');
  const g = f.geometry;
  if (!id || !g) return null;
  // Une parcelle en plusieurs morceaux : on garde le plus grand, le reste est rarissime.
  const polygones =
    g.type === 'Polygon'
      ? [g.coordinates as number[][][]]
      : g.type === 'MultiPolygon'
        ? (g.coordinates as number[][][][])
        : [];
  const principal = polygones.sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0))[0];
  if (!principal || !principal[0] || principal[0].length < 4) return null;
  const anneaux = principal.map((a) => a.map(arrondir));
  const ext = anneaux[0]!;
  const [lon, lat] = centre(ext);
  const xs = ext.map((p) => p[0]);
  const ys = ext.map((p) => p[1]);
  return {
    parcelle_id: id,
    commune,
    geometrie: anneaux,
    centre_lat: Math.round(lat * 1e7) / 1e7,
    centre_lon: Math.round(lon * 1e7) / 1e7,
    ouest: Math.min(...xs),
    sud: Math.min(...ys),
    est: Math.max(...xs),
    nord: Math.max(...ys),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const ecrire = args.includes('--ecrire');
  const communes = args.filter((a) => /^\d{5}$/.test(a));
  const liste = communes.length > 0 ? communes : ['75111', '75120'];
  const admin = ecrire ? createSupabaseAdminClient() : null;

  for (const commune of liste) {
    const res = await fetch(SOURCE(commune));
    if (!res.ok) throw new Error(`${commune} : téléchargement ${res.status}`);
    const json = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')) as {
      features?: Feature[];
    };
    const lignes = (json.features ?? []).map((f) => ligne(f, commune)).filter((l) => l !== null);
    const rejetees = (json.features?.length ?? 0) - lignes.length;
    const sommets = lignes.reduce((n, l) => n + l.geometrie.reduce((m, a) => m + a.length, 0), 0);
    console.log(
      `${commune} : ${lignes.length} parcelles, ${rejetees} rejetées, ${sommets} sommets, ~${Math.round(
        JSON.stringify(lignes).length / 1024,
      )} Ko`,
    );
    if (!admin) continue;
    for (let i = 0; i < lignes.length; i += 500) {
      const { error } = await admin.from('parcelles_geo' as never).upsert(lignes.slice(i, i + 500) as never, {
        onConflict: 'parcelle_id',
      });
      if (error) throw new Error(`${commune} : écriture ${error.message}`);
    }
    console.log(`${commune} : écrit.`);
  }
  if (!ecrire) console.log('Essai à blanc : rien n’a été écrit. Ajouter --ecrire pour importer.');
}

main().catch((e) => {
  console.error(e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : e);
  process.exit(1);
});
