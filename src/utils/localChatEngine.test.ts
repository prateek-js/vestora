/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { processLocalChatMessage } from './localChatEngine.ts';
import type { ChatEngineCallbacks, ChatEngineContext } from './localChatEngine.ts';

const ctx: ChatEngineContext = {
  holdings: [],
  portfolioMode: 'demo',
  profileName: 'Test',
};

function makeCallbacks(calls: string[]): ChatEngineCallbacks {
  const record = (name: string) => () => {
    calls.push(name);
  };
  return {
    onAddHolding: record('onAddHolding'),
    onUpdateHolding: record('onUpdateHolding'),
    onReplaceHoldings: record('onReplaceHoldings'),
    onAppendHoldings: record('onAppendHoldings'),
    onDeleteHolding: record('onDeleteHolding'),
    onNavigateToTab: record('onNavigateToTab'),
    onExportExcel: record('onExportExcel'),
    onExportCsv: record('onExportCsv'),
    onExportPdf: record('onExportPdf'),
    onExportJson: record('onExportJson'),
  };
}

test('story and game shortcuts point to the tour and navigate nowhere', () => {
  for (const message of ['story', 'game']) {
    const calls: string[] = [];
    const reply = processLocalChatMessage(message, ctx, makeCallbacks(calls));
    assert.equal(reply.title, 'Guided tour', message);
    assert.ok(reply.text.includes('/demo/'), message);
    assert.deepEqual(calls, [], message);
  }
});

test('a dollar amount parses as an INR number, not an error', () => {
  const calls: string[] = [];
  const reply = processLocalChatMessage('add $500 of HDFC index fund', ctx, makeCallbacks(calls));
  const json = JSON.stringify(reply);
  assert.ok(!/error|unsupported/i.test(json), `unexpected error reply: ${json}`);
  // The add path previews a holding; its amount is the plain number in INR.
  assert.ok(reply.metrics?.some((m) => m.value.includes('₹')), `no INR amount shown: ${json}`);
  assert.deepEqual(calls, [], 'add must preview first, not fire callbacks');
});

test('asking to set a holding to USD gets the INR acknowledgment, no change', () => {
  const holdingCtx: ChatEngineContext = {
    ...ctx,
    holdings: [
      {
        id: 'h-106',
        name: 'Nippon India Fund',
        category: 'MUTUAL_FUND',
        institution: 'Nippon India MF',
        investedAmount: 100000,
        currentValue: 120000,
        currency: 'INR',
        purchaseDate: '2024-01-01',
        unrealizedGain: 20000,
        unrealizedGainPct: 20,
        taxTag: 'LTCG_EQUITY',
      },
    ],
  };
  const calls: string[] = [];
  const reply = processLocalChatMessage('make Nippon India Fund USD', holdingCtx, makeCallbacks(calls));
  const json = JSON.stringify(reply);
  assert.ok(/INR/.test(json), `no INR acknowledgment: ${json}`);
  assert.ok(reply.text.includes('Vestora tracks holdings in INR.'), `wrong reply text: ${reply.text}`);
  assert.deepEqual(calls, [], 'currency request must change nothing');
  assert.ok(!/→ USD|Switched/i.test(json), `reply still speaks currency switching: ${json}`);
});
