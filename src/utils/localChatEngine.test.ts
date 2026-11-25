/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { processLocalChatMessage } from './localChatEngine.ts';
import type { ChatEngineCallbacks, ChatEngineContext } from './localChatEngine.ts';

const ctx: ChatEngineContext = {
  holdings: [],
  baseCurrency: 'INR',
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
    onSetBaseCurrency: record('onSetBaseCurrency'),
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
