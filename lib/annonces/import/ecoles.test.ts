import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ecolesSeLoger, motsCles, situerParEcoles, trianguler } from './ecoles';

/** Un point à dx, dy mètres d'un autre. */
function decale(p: { latitude: number; longitude: number }, dx: number, dy: number) {
  return { latitude: p.latitude + dy / 110_540, longitude: p.longitude + dx / (111_320 * Math.cos((p.latitude * Math.PI) / 180)) };
}

const LOGEMENT = { latitude: 48.860796, longitude: 2.372081 }; // 73 bd Richard Lenoir
const CENTRE_QUARTIER = decale(LOGEMENT, -250, 180);

describe('écoles SeLoger', () => {
  it('lit les écoles privées et leur distance, en mètres ou en kilomètres', () => {
    const location = {
      schools: {
        publicSchools: [{ name: 'Collège Beaumarchais', distanceKm: '702 m' }],
        privateSchools: [
          { name: 'École Élémentaire Privée Charles Peguy', distanceKm: '382 m' },
          { name: 'Collège Math Assistance Nation', distanceKm: '1 km' },
          { name: 'Sans distance' },
        ],
      },
    };
    assert.deepEqual(ecolesSeLoger(location), [
      { nom: 'École Élémentaire Privée Charles Peguy', distanceM: 382 },
      { nom: 'Collège Math Assistance Nation', distanceM: 1000 },
    ]);
  });

  it('garde du nom ce que l’annuaire peut chercher', () => {
    assert.deepEqual(motsCles('École Élémentaire Privée Charles Peguy'), ['Charles', 'Peguy']);
    assert.deepEqual(motsCles("Collège privé L'Autre Collège"), ['Autre']);
  });

  it('retrouve le logement à quelques mètres, malgré une école mal identifiée (à l’autre bout de Paris)', () => {
    const ecoles = [
      [380, 120],
      [-300, 260],
      [150, -420],
      [-90, -350],
      [460, 300],
    ].map(([dx, dy]) => {
      const position = decale(LOGEMENT, dx!, dy!);
      return { distanceM: Math.round(Math.hypot(dx!, dy!)), positions: [position] };
    });
    // « Yad Mordekhai » : l'annuaire ne connaît que l'établissement du 16e.
    ecoles.push({ distanceM: 596, positions: [{ latitude: 48.8653, longitude: 2.2735 }] });
    const point = trianguler(ecoles, CENTRE_QUARTIER)!;
    assert.ok(point, 'un point est trouvé');
    const ecart = Math.hypot(
      (point.longitude - LOGEMENT.longitude) * 111_320 * Math.cos((LOGEMENT.latitude * Math.PI) / 180),
      (point.latitude - LOGEMENT.latitude) * 110_540,
    );
    assert.ok(ecart < 5, `à ${ecart.toFixed(1)} m du logement`);
    assert.equal(point.concordantes, 5);
  });

  it('trois écoles ne suffisent pas : trois cercles se croisent presque toujours', () => {
    const ecoles = [
      [380, 120],
      [-300, 260],
      [150, -420],
    ].map(([dx, dy]) => ({ distanceM: Math.round(Math.hypot(dx!, dy!)), positions: [decale(LOGEMENT, dx!, dy!)] }));
    assert.equal(trianguler(ecoles, CENTRE_QUARTIER), null);
  });

  it('sans réponse de l’annuaire, rien n’est situé', async () => {
    const ecoles = ['A Un', 'B Deux', 'C Trois', 'D Quatre'].map((nom) => ({ nom: `Ecole ${nom}`, distanceM: 300 }));
    const zone = await situerParEcoles(ecoles, '75011', { ...CENTRE_QUARTIER, rayonM: 230 }, async () => ({ ok: false, json: async () => ({}) }));
    assert.equal(zone, null);
  });
});
