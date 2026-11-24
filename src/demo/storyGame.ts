import type { BucketMix } from '../utils/smartDiversification';

export interface Token {
  id: string;
  bucket: keyof BucketMix;
  /** Growth assets sit on the left pan, steadier ones on the right. */
  side: 'left' | 'right';
}

/** Each weight is worth this many points of the mix. */
export const TOKEN_POINTS = 10;

/** Six growth weights, three debt, one gold, and no cash: one move away from balanced. */
export function startingTokens(): Token[] {
  const growth: Token[] = Array.from({ length: 6 }, (_, i) => ({ id: `equity-${i}`, bucket: 'equity', side: 'left' }));
  const steady: Token[] = [
    ...Array.from({ length: 3 }, (_, i): Token => ({ id: `debt-${i}`, bucket: 'debt', side: 'right' })),
    { id: 'gold-0', bucket: 'gold', side: 'right' },
  ];
  return [...growth, ...steady];
}

/** Moves a weight to the other pan. Growth weights become cash on the steadier side, and steadier ones become equity. */
export function moveToken(tokens: Token[], id: string): Token[] {
  return tokens.map((t) => {
    if (t.id !== id) return t;
    return t.side === 'left'
      ? { ...t, side: 'right', bucket: 'cash' }
      : { ...t, side: 'left', bucket: 'equity' };
  });
}

export function tokensToMix(tokens: Token[]): BucketMix {
  const mix: BucketMix = { equity: 0, debt: 0, gold: 0, cash: 0 };
  for (const t of tokens) mix[t.bucket] += TOKEN_POINTS;
  return mix;
}
