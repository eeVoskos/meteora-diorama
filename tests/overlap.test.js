import test from 'node:test';
import assert from 'node:assert/strict';
import { pickVisible } from '../src/overlap.js';

const box = (x, y, pri) => ({ x0: x, y0: y, x1: x + 50, y1: y + 14, pri });

test('lower priority number wins an overlap, regardless of order', () => {
  assert.deepEqual(pickVisible([box(0, 0, 3), box(10, 2, 0)]), [false, true]);
});
test('separate labels all stay; padding counts as overlap', () => {
  assert.deepEqual(pickVisible([box(0, 0, 0), box(100, 0, 3)]), [true, true]);
  assert.deepEqual(pickVisible([box(0, 0, 0), box(51, 0, 3)]), [true, false]);
});
test('a hidden label does not hide others', () => {
  // b overlaps a (loses); c overlaps only b, so it survives
  assert.deepEqual(pickVisible([box(0, 0, 0), box(40, 0, 1), box(85, 0, 2)]), [true, false, true]);
});
test('equal-priority labels at one anchor: the second moves below instead of hiding', () => {
  // anchor at (100, 100); first rect above it, alt rect below it
  const lbl = () => ({ x0: 75, y0: 82, x1: 125, y1: 96, pri: 0, alt: { x0: 75, y0: 104, x1: 125, y1: 118 } });
  assert.deepEqual(pickVisible([lbl(), lbl()]), [true, 'alt']);
  // a third one has nowhere left to go
  assert.deepEqual(pickVisible([lbl(), lbl(), lbl()]), [true, 'alt', false]);
});
test('equal priority: the higher anchor keeps the top slot, the lower neighbour moves below', () => {
  // opening view: Great Meteoron's anchor (321, 259) sits just left of and below Varlaam's (395, 247)
  const at = (x, y, w, h = 18) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - h - 4, y1: y, pri: 0, alt: { x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h + 4 } });
  assert.deepEqual(pickVisible([at(321, 259, 112), at(395, 247, 64)]), ['alt', true]);
});
