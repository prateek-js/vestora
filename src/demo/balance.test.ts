/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceScore, beamState, gapSentence } from './balance.ts';

const target = { equity: 50, debt: 30, gold: 10, cash: 10 };
const current = { equity: 60, debt: 30, gold: 5, cash: 5 };

test('identical mixes score 100', () => {
  assert.equal(balanceScore(target, target), 100);
});

test('a mix 20 points away from target scores 60', () => {
  assert.equal(balanceScore(current, target), 60);
});

test('score never goes below zero', () => {
  const far = { equity: 100, debt: 0, gold: 0, cash: 0 };
  assert.equal(balanceScore(far, target), 0);
});

test('equity overweight tilts the beam toward growth and is not level', () => {
  const s = beamState(current, target);
  assert.equal(s.tiltDeg, 6);
  assert.equal(s.level, false);
  assert.equal(s.score, 60);
});

test('on-target mix is level with zero tilt', () => {
  const s = beamState(target, target);
  assert.ok(s.tiltDeg === 0, 'tilt is exactly 0, not -0');
  assert.equal(Object.is(s.tiltDeg, -0), false);
  assert.equal(s.level, true);
});

test('tilt is clamped to 14 degrees either way', () => {
  assert.equal(beamState({ equity: 100, debt: 0, gold: 0, cash: 0 }, target).tiltDeg, 14);
  assert.equal(beamState({ equity: 0, debt: 60, gold: 20, cash: 20 }, target).tiltDeg, -14);
});

test('gap sentence names the biggest gap and its direction', () => {
  assert.equal(gapSentence(current, target), 'Equity is 10 points over your target');
  assert.equal(
    gapSentence({ equity: 40, debt: 30, gold: 15, cash: 15 }, target),
    'Equity is 10 points under your target'
  );
});

test('gap sentence says on target when level', () => {
  assert.equal(gapSentence(target, target), 'Your mix is on target');
});

test('a one-point gap uses the singular', () => {
  assert.equal(
    gapSentence({ equity: 51, debt: 29, gold: 10, cash: 10 }, target),
    'Equity is 1 point over your target'
  );
});

test('ties on the largest gap pick equity, debt, gold, cash in that order', () => {
  assert.equal(
    gapSentence({ equity: 55, debt: 25, gold: 10, cash: 10 }, target),
    'Equity is 5 points over your target'
  );
});
