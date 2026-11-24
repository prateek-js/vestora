/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { MacroParameters } from '../types/wealth';
import { describeConditions } from './conditions.ts';

const base: MacroParameters = {
  inflationRatePct: 6.5,
  interestRateHikeBps: 150,
  geopoliticalShockIndex: 5,
  equityMarketShockPct: -12,
  projectionHorizonYears: 5,
};

test('the starting conditions are described in plain words', () => {
  assert.equal(
    describeConditions(base),
    'Inflation of 6.5% a year, interest rates up 1.5 points, global tension at 5 out of 10, and stocks down 12%.'
  );
});

test('rate cuts and a rally read the other way round', () => {
  assert.equal(
    describeConditions({ ...base, interestRateHikeBps: -50, equityMarketShockPct: 10 }),
    'Inflation of 6.5% a year, interest rates down 0.5 points, global tension at 5 out of 10, and stocks up 10%.'
  );
});

test('no change in rates or stocks is said plainly', () => {
  assert.equal(
    describeConditions({ ...base, interestRateHikeBps: 0, equityMarketShockPct: 0, geopoliticalShockIndex: 0 }),
    'Inflation of 6.5% a year, interest rates unchanged, global tension at 0 out of 10, and stocks flat.'
  );
});
