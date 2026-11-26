import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Holding } from '../types/wealth';
import { formatPercent } from './currency';
import { todayIso } from './maturity';
import {
  CATEGORY_META,
  computePortfolioSummaryMetrics,
  MomGrowthPoint,
  PortfolioTrendPoint,
} from './portfolioMetrics';

export interface PdfReportOptions {
  holdings: Holding[];
  portfolioMode?: 'demo' | 'personal';
  profileName?: string;
  /** Defaults to true; pass false in unit checks to inspect the generated PDF without downloading. */
  download?: boolean;
  fileName?: string;
}

type Rgb = [number, number, number];

const SLATE_900: Rgb = [12, 17, 27];
const OBSIDIAN_LOGO: Rgb = [10, 13, 28];
const SLATE_700: Rgb = [51, 65, 85];
const SLATE_600: Rgb = [71, 85, 105];
const SLATE_500: Rgb = [100, 116, 139];
const SLATE_300: Rgb = [203, 213, 225];
const SLATE_200: Rgb = [226, 232, 240];
const SLATE_50: Rgb = [248, 250, 252];
const COBALT_600: Rgb = [76, 92, 230];
const EMERALD_600: Rgb = [2, 162, 109];
const EMERALD_500: Rgb = [2, 195, 126];
const EMERALD_100: Rgb = [214, 250, 235];
const ROSE_600: Rgb = [225, 29, 72];
const ROSE_500: Rgb = [244, 63, 94];
const AMBER_600: Rgb = [217, 119, 6];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return SLATE_500;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return SLATE_500;
  return [r, g, b];
}

/**
 * Formats currency with an ASCII-safe 'INR ' prefix because built-in PDF Type1
 * fonts (Helvetica/Courier) do not include the Unicode Rupee glyph (₹).
 */
export function formatPdfCurrency(amount: number, compact = false): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (compact) {
    if (abs >= 10_000_000) return `${sign}INR ${(abs / 10_000_000).toFixed(2)} Cr`;
    if (abs >= 100_000) return `${sign}INR ${(abs / 100_000).toFixed(2)} L`;
    if (abs >= 1_000) return `${sign}INR ${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}INR ${Math.round(abs).toLocaleString('en-IN')}`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trimEnd()}...`;
}

function drawCardShell(doc: jsPDF, x: number, y: number, w: number, h: number, fill: Rgb = [255, 255, 255]): void {
  doc.setFillColor(...fill);
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  subtext: string,
  valueColor: Rgb = SLATE_900,
  subColor: Rgb = SLATE_500
): void {
  drawCardShell(doc, x, y, w, h, SLATE_50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_500);
  doc.text(label.toUpperCase(), x + 3.5, y + 5.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...valueColor);
  doc.text(value, x + 3.5, y + 11.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...subColor);
  doc.text(subtext, x + 3.5, y + 15.6);
}

function drawGrowthChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  trendData: PortfolioTrendPoint[]
): void {
  drawCardShell(doc, x, y, w, h);

  const startVal = trendData[0]?.valuation ?? 0;
  const endVal = trendData[trendData.length - 1]?.valuation ?? 0;
  const diffPct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : 0;

  // Card header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_900);
  doc.text('Portfolio Growth Trajectory (12-Month Trend)', x + 4, y + 6.5);

  // Legend & 12M Delta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...SLATE_600);

  const legendY = y + 6.3;
  // Valuation legend
  doc.setDrawColor(...EMERALD_600);
  doc.setLineWidth(0.7);
  doc.line(x + w - 76, legendY - 0.8, x + w - 71, legendY - 0.8);
  doc.text('Valuation', x + w - 69.5, legendY);

  // Invested legend
  doc.setDrawColor(...SLATE_500);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x + w - 53, legendY - 0.8, x + w - 48, legendY - 0.8);
  doc.setLineDashPattern([], 0);
  doc.text('Invested', x + w - 46.5, legendY);

  // 12M return badge text
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(diffPct >= 0 ? EMERALD_600 : ROSE_600));
  doc.text(`${formatPercent(diffPct)} (12M)`, x + w - 4, legendY, { align: 'right' });

  const padLeft = 22;
  const padRight = 5;
  const padTop = 12;
  const padBottom = 8;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  if (trendData.length === 0 || endVal <= 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE_500);
    doc.text('Add holdings to render the 12-month valuation growth chart.', x + w / 2, y + h / 2, {
      align: 'center',
    });
    return;
  }

  const allValues = trendData.flatMap((d) => [d.valuation, d.invested]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.12, 1);
  const minVal = Math.max(0, rawMin - spread * 0.18);
  const maxVal = rawMax + spread * 0.14;
  const range = Math.max(maxVal - minVal, 1);

  const toX = (idx: number) =>
    plotX + (trendData.length > 1 ? (idx / (trendData.length - 1)) * plotW : plotW / 2);
  const toY = (val: number) => plotY + plotH - ((val - minVal) / range) * plotH;

  // Shaded area polygon under Valuation curve
  const valPoints = trendData.map((d, i) => ({ px: toX(i), py: toY(d.valuation) }));
  const baseLineY = plotY + plotH;
  doc.setFillColor(...EMERALD_100);
  const polyDeltas: [number, number][] = [];
  for (let i = 1; i < valPoints.length; i++) {
    polyDeltas.push([valPoints[i].px - valPoints[i - 1].px, valPoints[i].py - valPoints[i - 1].py]);
  }
  polyDeltas.push([0, baseLineY - valPoints[valPoints.length - 1].py]);
  polyDeltas.push([valPoints[0].px - valPoints[valPoints.length - 1].px, 0]);
  doc.lines(polyDeltas, valPoints[0].px, valPoints[0].py, [1, 1], 'F', true);

  // Horizontal dashed gridlines & Y-axis labels (4 steps)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setLineWidth(0.2);
  for (let step = 0; step <= 3; step++) {
    const ratio = step / 3;
    const gy = plotY + plotH - ratio * plotH;
    const tickVal = minVal + ratio * range;
    doc.setDrawColor(...SLATE_200);
    doc.setLineDashPattern(step === 0 ? [] : [1.2, 1.2], 0);
    doc.line(plotX, gy, plotX + plotW, gy);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...SLATE_500);
    doc.text(formatPdfCurrency(tickVal, true), plotX - 2, gy + 0.9, {
      align: 'right',
    });
  }

  // Invested Capital dashed line
  const invPoints = trendData.map((d, i) => ({ px: toX(i), py: toY(d.invested) }));
  doc.setDrawColor(...SLATE_500);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([1.6, 1.4], 0);
  for (let i = 1; i < invPoints.length; i++) {
    doc.line(invPoints[i - 1].px, invPoints[i - 1].py, invPoints[i].px, invPoints[i].py);
  }
  doc.setLineDashPattern([], 0);

  // Valuation solid curve + points
  doc.setDrawColor(...EMERALD_600);
  doc.setLineWidth(0.65);
  for (let i = 1; i < valPoints.length; i++) {
    doc.line(valPoints[i - 1].px, valPoints[i - 1].py, valPoints[i].px, valPoints[i].py);
  }

  valPoints.forEach((pt, idx) => {
    const isLast = idx === valPoints.length - 1;
    const dotFill: Rgb = isLast ? EMERALD_500 : [255, 255, 255];
    doc.setFillColor(...dotFill);
    doc.setDrawColor(...EMERALD_600);
    doc.setLineWidth(0.4);
    doc.circle(pt.px, pt.py, isLast ? 1.15 : 0.75, 'FD');

    // X-axis month label
    doc.setFont('helvetica', isLast ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...(isLast ? SLATE_900 : SLATE_500));
    doc.text(trendData[idx].month, pt.px, y + h - 2.6, { align: 'center' });
  });
}

function drawMomBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  momData: MomGrowthPoint[],
  avgMonthlyGrowth: number,
  positiveMonths: number
): void {
  drawCardShell(doc, x, y, w, h);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_900);
  doc.text('Month-over-Month Net Growth', x + 4, y + 6.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...(avgMonthlyGrowth >= 0 ? EMERALD_600 : ROSE_600));
  doc.text(
    `Avg ${avgMonthlyGrowth >= 0 ? '+' : ''}${formatPdfCurrency(avgMonthlyGrowth, true)} · ${positiveMonths}/${momData.length} pos`,
    x + w - 4,
    y + 6.2,
    { align: 'right' }
  );

  const padLeft = 19;
  const padRight = 4;
  const padTop = 12;
  const padBottom = 8;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const hasNonZero = momData.some((d) => d.netGrowth !== 0);
  if (momData.length === 0 || !hasNonZero) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text('No monthly delta series available.', x + w / 2, y + h / 2, { align: 'center' });
    return;
  }

  const maxVal = Math.max(0, ...momData.map((d) => d.netGrowth));
  const minVal = Math.min(0, ...momData.map((d) => d.netGrowth));
  const paddedMax = maxVal > 0 ? maxVal * 1.15 : 1;
  const paddedMin = minVal < 0 ? minVal * 1.2 : 0;
  const range = Math.max(paddedMax - paddedMin, 1);

  const zeroY = plotY + (paddedMax / range) * plotH;

  // Grid top, zero, bottom
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setLineWidth(0.2);

  doc.setDrawColor(...SLATE_200);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(plotX, plotY, plotX + plotW, plotY);
  doc.setLineDashPattern([], 0);
  doc.setTextColor(...SLATE_500);
  doc.text(formatPdfCurrency(paddedMax, true), plotX - 1.5, plotY + 1, { align: 'right' });

  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.35);
  doc.line(plotX, zeroY, plotX + plotW, zeroY);
  doc.text('0', plotX - 1.5, zeroY + 0.8, { align: 'right' });

  if (paddedMin < 0) {
    doc.setDrawColor(...SLATE_200);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
    doc.setLineDashPattern([], 0);
    doc.text(formatPdfCurrency(paddedMin, true), plotX - 1.5, plotY + plotH + 0.5, {
      align: 'right',
    });
  }

  const slotW = plotW / momData.length;
  const barW = Math.min(4.8, slotW * 0.62);

  momData.forEach((d, idx) => {
    const cx = plotX + idx * slotW + slotW / 2;
    const barX = cx - barW / 2;
    const barH = Math.max(0.6, (Math.abs(d.netGrowth) / range) * plotH);
    const barY = d.netGrowth >= 0 ? zeroY - barH : zeroY;

    doc.setFillColor(...(d.netGrowth >= 0 ? EMERALD_500 : ROSE_500));
    doc.roundedRect(barX, barY, barW, barH, 0.5, 0.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...SLATE_500);
    doc.text(d.month.split(' ')[0], cx, y + h - 2.6, { align: 'center' });
  });
}

function drawAllocationPanel(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  breakdown: ReturnType<typeof computePortfolioSummaryMetrics>['categoryBreakdown']
): void {
  drawCardShell(doc, x, y, w, h);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_900);
  doc.text('Asset Allocation', x + 4, y + 6.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_500);
  doc.text(`${breakdown.length} active categories`, x + w - 4, y + 6.2, { align: 'right' });

  if (breakdown.length === 0) {
    doc.setFontSize(8);
    doc.text('No holdings in portfolio.', x + w / 2, y + h / 2, { align: 'center' });
    return;
  }

  // Stacked proportional horizontal bar
  const barX = x + 4;
  const barY = y + 10;
  const barW = w - 8;
  const barH = 3.6;

  let cursorX = barX;
  breakdown.forEach((item) => {
    const segW = (item.pct / 100) * barW;
    if (segW > 0.2) {
      doc.setFillColor(...hexToRgb(item.color));
      doc.rect(cursorX, barY, segW, barH, 'F');
      cursorX += segW;
    }
  });

  // Top 6 categories + optional "Other Categories" aggregate row
  const visibleRows =
    breakdown.length <= 6
      ? breakdown
      : [
          ...breakdown.slice(0, 5),
          {
            key: 'OTHER' as const,
            label: `Other (${breakdown.length - 5} categories)`,
            shortLabel: 'Other',
            color: '#64748b',
            value: breakdown.slice(5).reduce((s, r) => s + r.value, 0),
            count: breakdown.slice(5).reduce((s, r) => s + r.count, 0),
            pct: breakdown.slice(5).reduce((s, r) => s + r.pct, 0),
          },
        ];

  let rowY = y + 19.2;
  const rowStep = 6.3;

  visibleRows.forEach((item) => {
    doc.setFillColor(...hexToRgb(item.color));
    doc.circle(x + 5.2, rowY - 1, 1.1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...SLATE_700);
    doc.text(truncateText(item.label, 22), x + 8, rowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_900);
    doc.text(formatPdfCurrency(item.value, true), x + w - 16, rowY, {
      align: 'right',
    });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`${item.pct.toFixed(1)}%`, x + w - 4, rowY, { align: 'right' });

    rowY += rowStep;
  });
}

export function generatePortfolioPdfReport({
  holdings,
  portfolioMode = 'personal',
  profileName,
  download = true,
  fileName,
}: PdfReportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const reportDate = todayIso();

  const metrics = computePortfolioSummaryMetrics(holdings);

  // 1. Dark Obsidian Header Banner with Faceted Emerald Accent Bar & Brand Mark
  doc.setFillColor(...SLATE_900);
  doc.roundedRect(margin, margin, contentWidth, 20, 2.5, 2.5, 'F');
  doc.setFillColor(...EMERALD_500);
  doc.rect(margin, margin, contentWidth, 1.4, 'F');

  // Vector Vestora V-crest badge inside PDF banner
  const badgeX = margin + 5;
  const badgeY = margin + 4.4;
  doc.setFillColor(...OBSIDIAN_LOGO);
  doc.setDrawColor(...[38, 51, 74]);
  doc.setLineWidth(0.25);
  doc.roundedRect(badgeX, badgeY, 10.5, 10.5, 1.8, 1.8, 'FD');
  // Left ivory wing
  doc.setFillColor(241, 245, 249);
  doc.triangle(badgeX + 2.1, badgeY + 2.6, badgeX + 4.0, badgeY + 2.6, badgeX + 5.25, badgeY + 8.3, 'F');
  // Right emerald blade
  doc.setFillColor(...EMERALD_500);
  doc.triangle(badgeX + 6.5, badgeY + 2.6, badgeX + 8.4, badgeY + 2.6, badgeX + 5.25, badgeY + 8.3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('VESTORA', margin + 18.5, margin + 8.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_300);
  doc.text('PORTFOLIO WEALTH SUMMARY REPORT', margin + 18.5, margin + 14.8);

  const sessionLabel =
    portfolioMode === 'demo' && profileName
      ? `Sample Profile: ${profileName}`
      : 'Personal Simulation';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`As of ${reportDate}`, pageWidth - margin - 5, margin + 8.2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_300);
  doc.text(
    `${sessionLabel}  |  INR  |  ${holdings.length} Holdings`,
    pageWidth - margin - 5,
    margin + 14.5,
    { align: 'right' }
  );

  // 2. Key Statistics Grid (2 rows x 3 cards)
  const kpiStartY = margin + 24;
  const kpiGap = 3.5;
  const kpiW = (contentWidth - kpiGap * 2) / 3;
  const kpiH = 18.5;

  drawKpiCard(
    doc,
    margin,
    kpiStartY,
    kpiW,
    kpiH,
    'Total Net Worth',
    formatPdfCurrency(metrics.totalValuation),
    `30d: ${metrics.thirtyDayChangeAmount >= 0 ? '+' : ''}${formatPercent(metrics.thirtyDayChangePct)} (${metrics.thirtyDayChangeAmount >= 0 ? '+' : ''}${formatPdfCurrency(metrics.thirtyDayChangeAmount, true)})`,
    SLATE_900,
    metrics.thirtyDayChangeAmount >= 0 ? EMERALD_600 : ROSE_600
  );

  const multiple =
    metrics.totalInvested > 0 ? (metrics.totalValuation / metrics.totalInvested).toFixed(2) : '0.00';
  drawKpiCard(
    doc,
    margin + kpiW + kpiGap,
    kpiStartY,
    kpiW,
    kpiH,
    'Invested Capital',
    formatPdfCurrency(metrics.totalInvested),
    `${multiple}x cost multiple across ${holdings.length} positions`
  );

  drawKpiCard(
    doc,
    margin + (kpiW + kpiGap) * 2,
    kpiStartY,
    kpiW,
    kpiH,
    'Unrealized Gain',
    `${metrics.totalGain >= 0 ? '+' : ''}${formatPdfCurrency(metrics.totalGain)}`,
    `${formatPercent(metrics.totalGainPct)} overall return`,
    metrics.totalGain >= 0 ? EMERALD_600 : ROSE_600,
    metrics.totalGain >= 0 ? EMERALD_600 : ROSE_600
  );

  const row2Y = kpiStartY + kpiH + 3.5;
  const riskColor: Rgb =
    metrics.riskScore.score === 0
      ? SLATE_500
      : metrics.riskScore.score >= 75
      ? ROSE_600
      : metrics.riskScore.score >= 55
      ? AMBER_600
      : metrics.riskScore.score >= 30
      ? COBALT_600
      : EMERALD_600;

  drawKpiCard(
    doc,
    margin,
    row2Y,
    kpiW,
    kpiH,
    'Portfolio Risk Score',
    metrics.riskScore.score > 0
      ? `${metrics.riskScore.score} / 100 (${metrics.riskScore.posture})`
      : 'No Holdings',
    metrics.riskScore.score > 0
      ? `${metrics.riskScore.annualizedVolatilityPct}% est. vol · ${metrics.riskScore.equityExposurePct}% equity`
      : 'Add holdings to compute risk',
    riskColor
  );

  drawKpiCard(
    doc,
    margin + kpiW + kpiGap,
    row2Y,
    kpiW,
    kpiH,
    'Weighted Fixed Yield',
    metrics.weightedYieldPct !== null ? `${metrics.weightedYieldPct.toFixed(2)}% p.a.` : 'N/A',
    metrics.weightedYieldPct !== null
      ? 'Across interest-bearing holdings'
      : 'No rate-bearing debt instruments'
  );

  drawKpiCard(
    doc,
    margin + (kpiW + kpiGap) * 2,
    row2Y,
    kpiW,
    kpiH,
    'Matured / Due 30d',
    formatPdfCurrency(metrics.totalMaturedAmount),
    `${metrics.maturedHoldings.length} matured · ${metrics.maturingSoonHoldings.length} due within 30d`,
    metrics.maturedHoldings.length > 0 ? AMBER_600 : SLATE_900
  );

  // 3. Growth Line & Area Chart (Full Width)
  const growthChartY = row2Y + kpiH + 4.5;
  const growthChartH = 62;
  drawGrowthChart(doc, margin, growthChartY, contentWidth, growthChartH, metrics.trendData);

  // 4. Lower Analytics Row: MoM Bar Chart + Asset Allocation Breakdown
  const lowerY = growthChartY + growthChartH + 4.5;
  const lowerH = 58;
  const leftW = 90;
  const rightW = contentWidth - leftW - 4;

  drawMomBarChart(
    doc,
    margin,
    lowerY,
    leftW,
    lowerH,
    metrics.momData,
    metrics.avgMonthlyGrowth,
    metrics.positiveMonths
  );

  drawAllocationPanel(
    doc,
    margin + leftW + 4,
    lowerY,
    rightW,
    lowerH,
    metrics.categoryBreakdown
  );

  // 5. Key Portfolio Highlights Box
  const notesY = lowerY + lowerH + 4.5;
  const notesH = 34;
  drawCardShell(doc, margin, notesY, contentWidth, notesH, SLATE_50);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...SLATE_900);
  doc.text('Portfolio Highlights & Record Notes', margin + 4, notesY + 6);

  const highlights: string[] = [];
  if (holdings.length === 0) {
    highlights.push('This portfolio currently has 0 holdings. Import an Excel/CSV sheet or add holdings in Vestora.');
  } else {
    if (metrics.bestMonth) {
      highlights.push(
        `Strongest 12M expansion month: ${metrics.bestMonth.fullDate} (${metrics.bestMonth.netGrowth >= 0 ? '+' : ''}${formatPdfCurrency(metrics.bestMonth.netGrowth, true)}, ${formatPercent(metrics.bestMonth.netGrowthPct)}).`
      );
    }
    if (metrics.surgeHoldings30d.length > 0) {
      const topList = metrics.surgeHoldings30d
        .slice(0, 3)
        .map((item) => `${item.holding.name} (+${item.gain30d.toFixed(1)}%)`)
        .join(', ');
      highlights.push(`30-day outperformers (>15% gain): ${topList}.`);
    } else {
      const topOverall = [...holdings].sort((a, b) => b.unrealizedGainPct - a.unrealizedGainPct)[0];
      if (topOverall) {
        highlights.push(
          `Top overall performer: ${topOverall.name} (${formatPercent(topOverall.unrealizedGainPct)}).`
        );
      }
    }
    if (metrics.maturedHoldings.length > 0 || metrics.maturingSoonHoldings.length > 0) {
      highlights.push(
        `Maturity attention: ${metrics.maturedHoldings.length} matured (${formatPdfCurrency(metrics.totalMaturedAmount, true)}) and ${metrics.maturingSoonHoldings.length} maturing within 30 days.`
      );
    } else {
      highlights.push(
        `Concentration check: largest single holding represents ${metrics.riskScore.topHoldingSharePct}% of total wealth.`
      );
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...SLATE_700);
  let bulletY = notesY + 12.2;
  highlights.slice(0, 3).forEach((line) => {
    const wrapped = doc.splitTextToSize(`•  ${line}`, contentWidth - 8);
    doc.text(wrapped, margin + 4, bulletY);
    bulletY += wrapped.length * 4.2 + 1.4;
  });

  // 6. Page 2+: Full Holdings Ledger Table
  if (holdings.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE_900);
    doc.text('Holdings Ledger Breakdown', margin, margin + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text(
      `All ${holdings.length} active positions as of ${reportDate}. All amounts are INR.`,
      margin,
      margin + 9.5
    );

    const sortedHoldings = [...holdings].sort(
      (a, b) =>
        b.currentValue -
        a.currentValue
    );

    const tableRows = sortedHoldings.map((h) => {
      const catLabel = CATEGORY_META[h.category]?.shortLabel ?? h.category;
      const gainStr = `${h.unrealizedGain >= 0 ? '+' : ''}${formatPdfCurrency(h.unrealizedGain, true)} (${formatPercent(h.unrealizedGainPct, 1)})`;
      const rateOr30d =
        typeof h.interestRatePct === 'number'
          ? `${h.interestRatePct.toFixed(2)}% p.a.`
          : typeof h.gain30dPct === 'number'
          ? `30d: ${formatPercent(h.gain30dPct, 1)}`
          : '—';
      const maturityLabel = h.maturityDate
        ? h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
          ? `${h.maturityDate} (Matured)`
          : h.maturityDate
        : 'Perpetual';

      return [
        h.name,
        catLabel,
        h.institution,
        formatPdfCurrency(h.investedAmount),
        formatPdfCurrency(h.currentValue),
        gainStr,
        rateOr30d,
        maturityLabel,
      ];
    });

    autoTable(doc, {
      startY: margin + 13,
      margin: { left: margin, right: margin, bottom: 18 },
      head: [['Instrument', 'Category', 'Institution', 'Invested', 'Current Value', 'Unrealized Gain', 'Yield / 30d', 'Maturity']],
      body: tableRows,
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.3,
        textColor: SLATE_900,
        lineColor: SLATE_200,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: SLATE_900,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: SLATE_50,
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 21 },
        2: { cellWidth: 24 },
        3: { cellWidth: 21, halign: 'right' },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 13 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const text = String(data.cell.raw ?? '');
          data.cell.styles.textColor = text.startsWith('-') ? ROSE_600 : EMERALD_600;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // 7. Page Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 11.5, pageWidth - margin, pageHeight - 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.text(
      "Vestora · Generated privately on your device (we don't store your data with us) · Self-reported summary, not investment or tax advice.",
      margin,
      pageHeight - 7
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  if (download) {
    doc.save(fileName ?? `vestora-wealth-report-${reportDate}.pdf`);
  }

  return doc;
}
