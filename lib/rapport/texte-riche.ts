/**
 * Texte riche minimal : paragraphes, gras, italique, listes à puces.
 * L’agent ne choisit ni police ni taille.
 */

export type RunTexte = {
  text: string;
  gras?: boolean;
  italique?: boolean;
};

export type BlocParagraphe = { type: 'p'; runs: RunTexte[] };
export type BlocListe = { type: 'ul'; items: RunTexte[][] };
export type BlocTexte = BlocParagraphe | BlocListe;
export type CorpsTexte = BlocTexte[];

function texte(raw: string | null | undefined): string {
  return raw?.replace(/\s+/g, ' ').trim() ?? '';
}

export function runEstVide(run: RunTexte): boolean {
  return texte(run.text).length === 0;
}

export function runsSontVides(runs: RunTexte[]): boolean {
  return runs.every(runEstVide);
}

export function blocEstVide(bloc: BlocTexte): boolean {
  if (bloc.type === 'p') return runsSontVides(bloc.runs);
  return bloc.items.every(runsSontVides);
}

export function corpsEstVide(corps: CorpsTexte): boolean {
  return corps.every(blocEstVide);
}

export function normaliserRuns(raw: unknown): RunTexte[] {
  if (!Array.isArray(raw)) return [];
  const runs: RunTexte[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const t = typeof rec.text === 'string' ? rec.text : '';
    if (!t) continue;
    const run: RunTexte = { text: t };
    if (rec.gras === true) run.gras = true;
    if (rec.italique === true) run.italique = true;
    runs.push(run);
  }
  return runs;
}

export function normaliserCorps(raw: unknown): CorpsTexte {
  if (!Array.isArray(raw)) return [];
  const out: CorpsTexte = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === 'ul') {
      const items = Array.isArray(rec.items)
        ? rec.items.map((it) => (Array.isArray(it) ? normaliserRuns(it) : [])).filter((it) => !runsSontVides(it))
        : [];
      if (items.length > 0) out.push({ type: 'ul', items });
      continue;
    }
    const runs = normaliserRuns(rec.runs);
    if (!runsSontVides(runs)) out.push({ type: 'p', runs });
  }
  return out;
}

function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function runsVersHtml(runs: RunTexte[]): string {
  return runs
    .map((run) => {
      let html = echapper(run.text);
      if (run.italique) html = `<em>${html}</em>`;
      if (run.gras) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');
}

export function corpsVersHtml(corps: CorpsTexte): string {
  return corps
    .filter((bloc) => !blocEstVide(bloc))
    .map((bloc) => {
      if (bloc.type === 'ul') {
        const lis = bloc.items
          .filter((item) => !runsSontVides(item))
          .map((item) => `<li>${runsVersHtml(item)}</li>`)
          .join('');
        return lis ? `<ul>${lis}</ul>` : '';
      }
      return `<p>${runsVersHtml(bloc.runs)}</p>`;
    })
    .join('');
}

function lireRuns(node: Node): RunTexte[] {
  const runs: RunTexte[] = [];
  const walk = (n: Node, gras: boolean, italique: boolean) => {
    if (n.nodeType === 3) {
      const t = n.textContent ?? '';
      if (t) runs.push({ text: t, ...(gras ? { gras: true } : {}), ...(italique ? { italique: true } : {}) });
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    const nextGras = gras || tag === 'strong' || tag === 'b';
    const nextItal = italique || tag === 'em' || tag === 'i';
    if (tag === 'br') {
      runs.push({ text: '\n' });
      return;
    }
    el.childNodes.forEach((child) => walk(child, nextGras, nextItal));
  };
  walk(node, false, false);
  return fusionnerRuns(runs);
}

function fusionnerRuns(runs: RunTexte[]): RunTexte[] {
  const out: RunTexte[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && last.gras === run.gras && last.italique === run.italique) {
      last.text += run.text;
    } else {
      out.push({ ...run });
    }
  }
  return out.filter((r) => r.text.length > 0);
}

export function htmlVersCorps(html: string): CorpsTexte {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const corps: CorpsTexte = [];

  const pousserParagraphe = (node: Node) => {
    const runs = lireRuns(node).map((r) => ({ ...r, text: r.text.replace(/\u00a0/g, ' ') }));
    const parties = runsVersParagraphes(runs);
    for (const p of parties) {
      if (!runsSontVides(p)) corps.push({ type: 'p', runs: p });
    }
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      if (texte(node.textContent)) pousserParagraphe(node);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      const items: RunTexte[][] = [];
      el.querySelectorAll(':scope > li').forEach((li) => {
        const runs = lireRuns(li);
        if (!runsSontVides(runs)) items.push(runs);
      });
      if (items.length > 0) corps.push({ type: 'ul', items });
      return;
    }
    pousserParagraphe(el);
  });

  return normaliserCorps(corps);
}

function runsVersParagraphes(runs: RunTexte[]): RunTexte[][] {
  const paras: RunTexte[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) paras.push([]);
      if (part) paras[paras.length - 1]!.push({ ...run, text: part });
    });
  }
  return paras;
}

export function texteBrutCorps(corps: CorpsTexte): string {
  return corps
    .map((bloc) => {
      if (bloc.type === 'ul') {
        return bloc.items.map((item) => item.map((r) => r.text).join('')).join(' ');
      }
      return bloc.runs.map((r) => r.text).join('');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
