import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMonthCells,
  formatDatePickerLabel,
  isoDate,
  parseIsoDate,
} from '../../lib/ui/date-picker';

describe('DatePickerField helpers', () => {
  it('formate en français', () => {
    assert.equal(formatDatePickerLabel('2026-08-26', false), '26 août 2026');
    assert.match(formatDatePickerLabel('2026-08-26', true), /26/);
  });

  it('construit 42 cases par mois', () => {
    const cells = buildMonthCells(new Date(2026, 7, 1, 12));
    assert.equal(cells.length, 42);
    assert.equal(cells.filter((c) => c.inMonth).length, 31);
  });

  it('round-trip ISO', () => {
    const iso = isoDate(new Date(2026, 7, 26, 12));
    assert.equal(iso, '2026-08-26');
    assert.equal(isoDate(parseIsoDate(iso)!), iso);
  });
});
