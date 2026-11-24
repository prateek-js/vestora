/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_MIX_BY_GOAL } from '../utils/smartDiversification';
import { beamState } from './balance.ts';
import { moveToken, startingTokens, tokensToMix } from './storyGame.ts';

const target = TARGET_MIX_BY_GOAL.BALANCED.weights;

test('the game starts lopsided toward growth and not level', () => {
  const mix = tokensToMix(startingTokens());
  assert.deepEqual(mix, { equity: 60, debt: 30, gold: 10, cash: 0 });
  const beam = beamState(mix, target);
  assert.equal(beam.level, false);
  assert.equal(beam.score, 60);
  assert.ok(beam.tiltDeg > 0, 'growth side is heavy');
});

test('moving one growth weight across levels the beam', () => {
  const tokens = startingTokens();
  const growth = tokens.filter((t) => t.side === 'left');
  assert.ok(growth.length > 0);
  for (const t of growth) {
    const mix = tokensToMix(moveToken(tokens, t.id));
    const beam = beamState(mix, target);
    assert.deepEqual(mix, { equity: 50, debt: 30, gold: 10, cash: 10 });
    assert.equal(beam.level, true);
    assert.equal(beam.score, 100);
  }
});

test('a weight moved to the steadier side becomes cash', () => {
  const tokens = startingTokens();
  const first = tokens.find((t) => t.side === 'left')!;
  const moved = moveToken(tokens, first.id).find((t) => t.id === first.id)!;
  assert.equal(moved.side, 'right');
  assert.equal(moved.bucket, 'cash');
});

test('a steadier weight moved to the growth side becomes equity', () => {
  const tokens = startingTokens();
  const debt = tokens.find((t) => t.bucket === 'debt')!;
  const mix = tokensToMix(moveToken(tokens, debt.id));
  assert.deepEqual(mix, { equity: 70, debt: 20, gold: 10, cash: 0 });
});

test('moving a weight twice puts the mix back where it started', () => {
  const tokens = startingTokens();
  const id = tokens[0].id;
  assert.deepEqual(tokensToMix(moveToken(moveToken(tokens, id), id)), tokensToMix(tokens));
});

test('moving does not change the original list, and an unknown id changes nothing', () => {
  const tokens = startingTokens();
  const snapshot = JSON.stringify(tokens);
  moveToken(tokens, tokens[0].id);
  assert.equal(JSON.stringify(tokens), snapshot);
  assert.deepEqual(moveToken(tokens, 'nope'), tokens);
});

test('token ids are unique so each weight can be found again', () => {
  const ids = startingTokens().map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});
