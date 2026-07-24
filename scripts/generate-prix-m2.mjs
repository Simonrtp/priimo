import { writeFileSync, mkdirSync } from 'fs';

const cps = new Set();
for (let i = 1; i <= 20; i++) cps.add(`750${String(i).padStart(2, '0')}`);
const extras = [
  69001, 69002, 69003, 69004, 69005, 69006, 69007, 69008, 69009,
  13001, 13002, 13003, 13004, 13005, 13006, 13007, 13008, 13009, 13010,
  13011, 13012, 13013, 13014, 13015, 13016,
  31000, 33000, 34000, 35000, 44000, 59000, 67000, 6000, 6300,
  92100, 92200, 92300, 92400, 92500, 92600, 92700, 92800,
  93100, 93200, 93300, 93400, 94100, 94200, 94300, 94400,
  78000, 78100, 78200, 78300, 91000, 94000, 95000,
];
for (const n of extras) cps.add(String(n).padStart(5, '0'));

const sorted = [...cps].sort();
const lines = [
  '{',
  '  "_comment": "Mediane EUR/m2 DVF a renseigner. Valeur 0 ou CP absent = pas de fourchette (recontact conseiller).",',
];
sorted.forEach((k, i) => {
  const comma = i < sorted.length - 1 ? ',' : '';
  lines.push(`  "${k}": 0${comma}`);
});
lines.push('}', '');

mkdirSync('data', { recursive: true });
writeFileSync('data/prix-m2-reference.json', lines.join('\n'));
console.log('wrote', sorted.length, 'keys');
