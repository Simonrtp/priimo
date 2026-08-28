import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_INTENT,
  INTERPRET_EXAMPLES,
  parseIntent,
  stripJsonFences,
  type AssistantIntent,
} from './intent';
import { interpretQuestion } from './interpret';

describe('stripJsonFences', () => {
  it('retire les backticks autour d’un JSON', () => {
    assert.equal(stripJsonFences('```json\n{"type":"inconnu"}\n```'), '{"type":"inconnu"}');
  });
});

describe('parseIntent — robustesse', () => {
  it('traite une sortie vide comme inconnu', () => {
    assert.equal(parseIntent('').type, 'inconnu');
    assert.equal(parseIntent(null).type, 'inconnu');
    assert.equal(parseIntent('   ').type, 'inconnu');
  });

  it('traite un JSON malformé comme inconnu, sans lever', () => {
    assert.deepEqual(parseIntent('{pas json'), EMPTY_INTENT);
    assert.equal(parseIntent('[]').type, 'inconnu');
  });

  it('accepte un JSON entouré de backticks', () => {
    const raw = '```json\n{"type":"immeuble","adresse":"27 rue Alphonse Penaud","code_postal":null,"nom":null,"periode_jours":null,"filtres":{"type_contact":null,"statut_mandat":null}}\n```';
    const intent = parseIntent(raw);
    assert.equal(intent.type, 'immeuble');
    assert.equal(intent.adresse, '27 rue Alphonse Penaud');
  });
});

describe('interprétation — questions types', () => {
  it('extrait le type et l’adresse attendus pour chaque exemple', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        temperature?: number;
        messages?: Array<{ content?: string }>;
      };
      seen.push(body as Record<string, unknown>);
      const user = body.messages?.[1]?.content ?? '';
      const example = INTERPRET_EXAMPLES.find((ex) => user.includes(ex.question));
      const intent: AssistantIntent = example?.intent ?? EMPTY_INTENT;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(intent) } }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    // Le contrat porte sur l'aller-retour de chaque exemple, pas sur leur
    // nombre : en ajouter un ne doit pas casser ce test.
    assert.ok(INTERPRET_EXAMPLES.length >= 11, `${INTERPRET_EXAMPLES.length} exemples`);

    for (const ex of INTERPRET_EXAMPLES) {
      const intent = await interpretQuestion(ex.question, 'test-key', fetchImpl);
      assert.equal(intent.type, ex.intent.type, ex.question);
      assert.equal(intent.adresse, ex.intent.adresse, ex.question);
      assert.equal(intent.nom, ex.intent.nom, ex.question);
      assert.equal(intent.code_postal, ex.intent.code_postal, ex.question);
    }

    assert.equal(seen[0]?.temperature, 0);
  });
});
