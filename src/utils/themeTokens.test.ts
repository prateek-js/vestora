/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_META } from './portfolioMetrics.ts';

// Theme-drift guard. Vestora's look lives in tokens (src/index.css @theme, mirrored
// in src/demo/demo.css). Tailwind's stock color ramps, stock mono font and black
// backdrops silently bypass them, so the demo and the app drift apart. These tests
// fail the moment a component reaches for something the brand theme doesn't define.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(SRC, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allSrc = walk(SRC).filter((f) => !f.endsWith('.test.ts'));
const tsxFiles = allSrc.filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(f, 'utf-8');
const indexCss = read(join(SRC, 'index.css'));
const demoCss = read(join(SRC, 'demo', 'demo.css'));
// The share kit (social frames + reel compositions) ships rendered images of the
// product — its sources obey the same one-family rule as the app.
const SHARE_KIT = join(ROOT, 'tools', 'share-kit');
const shareKitTextFiles = walk(SHARE_KIT).filter((f) => /\.(html?|css)$/.test(f));

const REMAPPED_RAMPS = ['slate', 'emerald', 'indigo', 'amber', 'rose', 'sky'];
const STOCK_RAMPS_BANNED = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'violet', 'purple', 'fuchsia', 'pink', 'stone', 'zinc', 'neutral', 'gray'];
const PREFIX = '(?:bg|text|border(?:-[xytblrse])?|ring|from|to|via|shadow|fill|stroke|divide|outline|decoration|accent|caret|placeholder)';

test('every Tailwind ramp shade the app uses is remapped to the brand theme', () => {
  const defined = new Set<string>();
  for (const m of indexCss.matchAll(/--color-([a-z]+)-(\d+)\s*:/g)) defined.add(`${m[1]}-${m[2]}`);

  const used = new Map<string, string>(); // "amber-600" -> first file using it
  const re = new RegExp(`\\b${PREFIX}-(${REMAPPED_RAMPS.join('|')})-(\\d{2,3})\\b`, 'g');
  for (const f of tsxFiles) {
    for (const m of read(f).matchAll(re)) {
      const key = `${m[1]}-${m[2]}`;
      if (!used.has(key)) used.set(key, relative(ROOT, f));
    }
  }
  const missing = [...used].filter(([k]) => !defined.has(k)).map(([k, f]) => `${k} (first in ${f})`);
  assert.deepEqual(missing, [], `these stock-Tailwind shades render off-brand — define them in index.css @theme: ${missing.join(', ')}`);
});

test('no stock Tailwind ramp outside the six remapped ones is used anywhere', () => {
  const re = new RegExp(`\\b${PREFIX}-(${STOCK_RAMPS_BANNED.join('|')})-\\d{2,3}\\b`, 'g');
  const hits: string[] = [];
  for (const f of tsxFiles) for (const m of read(f).matchAll(re)) hits.push(`${m[0]} in ${relative(ROOT, f)}`);
  assert.deepEqual(hits, []);
});

test('the demo uses brand tokens only — demo.css remaps no ramps, so none may be used there', () => {
  const re = new RegExp(`\\b${PREFIX}-(${REMAPPED_RAMPS.join('|')})-\\d{2,3}\\b`, 'g');
  const hits: string[] = [];
  for (const f of tsxFiles.filter((f) => f.includes(`${join('src', 'demo')}`))) {
    for (const m of read(f).matchAll(re)) hits.push(`${m[0]} in ${relative(ROOT, f)}`);
  }
  assert.deepEqual(hits, []);
});

test('overlays dim with ink, never pure black', () => {
  const hits: string[] = [];
  for (const f of tsxFiles) for (const m of read(f).matchAll(/\bbg-black(?:\/\d+)?\b/g)) hits.push(`${m[0]} in ${relative(ROOT, f)}`);
  assert.deepEqual(hits, []);
});

test('one font family: display, body and mono tokens all resolve to Figtree in both stylesheets', () => {
  for (const [name, css] of [['index.css', indexCss], ['demo.css', demoCss]] as const) {
    for (const token of ['--font-display', '--font-body', '--font-mono']) {
      const m = css.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
      assert.ok(m, `${name} defines ${token}`);
      assert.match(m[1].trim(), /^['"]?Figtree['"]?/, `${name}: ${token} must resolve to Figtree, got ${m[1].trim()}`);
    }
  }
  const rule = indexCss.match(/\.font-mono\s*,\s*\.tabular-nums\s*\{([^}]*)\}/);
  assert.ok(rule, 'index.css keeps its tabular-nums base rule');
  assert.doesNotMatch(rule[1], /font-family/, 'the base rule must not re-impose a font family');
  assert.match(rule[1], /tabular-nums/);
});

test('no other typeface is referenced or downloaded anywhere (no Bricolage, no JetBrains Mono)', () => {
  const heads = ['index.html', 'demo/index.html', 'ltcg-tax-harvesting-india/index.html', 'fd-maturity-reinvestment-guide/index.html', 'home-loan-vs-fd-calculator/index.html', 'mutual-fund-rebalance-india/index.html'];
  const stale = [...allSrc.filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => relative(ROOT, f)), ...heads, ...shareKitTextFiles.map((f) => relative(ROOT, f))]
    .filter((f) => /Bricolage|JetBrains/i.test(read(join(ROOT, f))));
  assert.deepEqual(stale, [], 'only Figtree may be loaded or named');
});

test('the reel bundles no font file other than Figtree', () => {
  const fonts = walk(join(SHARE_KIT, 'reel', 'assets', 'fonts')).map((f) => relative(ROOT, f));
  const nonFigtree = fonts.filter((f) => !/figtree/i.test(f));
  assert.deepEqual(nonFigtree, [], `delete the stale font files: ${nonFigtree.join(', ')}`);
});

// ---- the 11-way category palette (donut slices, legend dots, hover label) ----

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (h: string) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrastOnWhite = (h: string) => 1.05 / (luminance(h) + 0.05);
const lab = (h: string) => {
  const [r, g, b] = hexRgb(h).map(lin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const hue = (h: string) => {
  const [r, g, b] = hexRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hh * 60 + 360) % 360;
};

const categoryColors = Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color] as const);

test('category colors stay readable as text on Paper (4.5:1) — the donut hover label reuses them', () => {
  const low = categoryColors.filter(([, c]) => contrastOnWhite(c) < 4.5).map(([k, c]) => `${k} ${c} ${contrastOnWhite(c).toFixed(2)}`);
  assert.deepEqual(low, []);
});

test('category colors stay distinguishable (min pairwise ΔE76 ≥ 12)', () => {
  let min = Infinity, pair = '';
  for (let i = 0; i < categoryColors.length; i++) for (let j = i + 1; j < categoryColors.length; j++) {
    const d = deltaE(categoryColors[i][1], categoryColors[j][1]);
    if (d < min) { min = d; pair = `${categoryColors[i][0]} vs ${categoryColors[j][0]}`; }
  }
  assert.ok(min >= 12, `closest pair is ${pair} at ΔE ${min.toFixed(1)}`);
});

test('category colors come from the brand hue families (equity/cash-ink blues, debt teals, level green, gold) — no violet, no lime', () => {
  // Brand anchors: equity 232°, ink/cash ~215-222°, debt 190°, level 160°, gold 40° — each ±22°.
  const windows: Array<[number, number]> = [[18, 64], [136, 254]];
  const off = categoryColors.filter(([, c]) => !windows.some(([lo, hi]) => hue(c) >= lo && hue(c) <= hi)).map(([k, c]) => `${k} ${c} hue ${hue(c).toFixed(0)}°`);
  assert.deepEqual(off, []);
});
