import { EMERGENCY_DISCLAIMER, INTENSITY_META, REPORT_FOOTER } from '../constants';
import { MONTH_NAMES_SHORT, formatDate, formatDateTime, formatTime, parseLocalDate } from '../lib/dates';
import { afterEffectLabel, contextTagLabel, formatDuration } from '../lib/format';
import { computeStats, filterEvents } from '../lib/stats';
import { INTENSITIES } from '../types';
import type { Child, EventWithDetails, IntensityGuide, WeekBucket } from '../types';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function weekLabel(weekStart: string): string {
  const d = parseLocalDate(weekStart);
  if (!d) return weekStart;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
}

export function buildWeeklyChartSvg(weekly: WeekBucket[], width: number, height: number): string {
  const padL = 32;
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const maxTotal = Math.max(1, ...weekly.map((w) => w.low + w.medium + w.high));
  const step = maxTotal <= 10 ? 1 : Math.ceil(maxTotal / 5);
  const yMax = Math.ceil(maxTotal / step) * step;
  const y = (v: number): number => padT + plotH - (v / yMax) * plotH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Seizures per week by intensity" font-family="sans-serif" font-size="9">`,
  );
  for (let v = 0; v <= yMax; v += step) {
    const yy = y(v).toFixed(1);
    parts.push(
      `<line x1="${padL}" x2="${width - padR}" y1="${yy}" y2="${yy}" stroke="#d0d4da" stroke-width="0.5"/>`,
      `<text x="${padL - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" fill="#444">${v}</text>`,
    );
  }
  const n = Math.max(1, weekly.length);
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const labelEvery = weekly.length > 14 ? Math.ceil(weekly.length / 12) : 1;
  weekly.forEach((w, i) => {
    const x = padL + slot * i + (slot - barW) / 2;
    let acc = 0;
    for (const k of INTENSITIES) {
      const c = w[k];
      if (c <= 0) continue;
      const top = y(acc + c);
      const h = y(acc) - top;
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${INTENSITY_META[k].color}"><title>${weekLabel(w.weekStart)}: ${c} ${INTENSITY_META[k].label}</title></rect>`,
      );
      acc += c;
    }
    if (i % labelEvery === 0) {
      parts.push(
        `<text x="${(x + barW / 2).toFixed(1)}" y="${height - padB + 12}" text-anchor="middle" fill="#444">${escapeHtml(weekLabel(w.weekStart))}</text>`,
      );
    }
  });
  parts.push(
    `<line x1="${padL}" x2="${width - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#666" stroke-width="0.8"/>`,
  );
  parts.push('</svg>');
  return parts.join('');
}

function legendHtml(): string {
  return `<div class="legend">${INTENSITIES.map(
    (k) =>
      `<span><span style="color:${INTENSITY_META[k].color}">${INTENSITY_META[k].glyph}</span> ${INTENSITY_META[k].label}</span>`,
  ).join('')}</div>`;
}

const CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; background: #fff; font-size: 11px; line-height: 1.4; margin: 0; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
.meta { color: #444; margin: 2px 0; }
.summary { display: flex; flex-wrap: wrap; gap: 8px; }
.card { border: 1px solid #ccc; border-radius: 6px; padding: 6px 10px; min-width: 90px; }
.card b { display: block; font-size: 16px; }
.legend { margin-top: 4px; } .legend span { margin-right: 14px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f0f2f5; }
ol { margin: 0; padding-left: 20px; }
.small { font-size: 9px; color: #444; }
.footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 6px; font-size: 9px; color: #444; }
`;

export function buildReportHtml(input: {
  child: Child;
  events: EventWithDetails[];
  from: Date;
  to: Date;
  generatedAt: Date;
  guide: IntensityGuide;
}): string {
  const { child, from, to, generatedAt, guide } = input;
  const events = filterEvents(input.events, from, to).sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  const stats = computeStats(events, from, to);
  const e = escapeHtml;

  const header = `<h1>Seizure log — ${e(child.display_name)}</h1>
<div class="meta">${e(formatDate(from))} – ${e(formatDate(to))}</div>
<div class="meta">Generated ${e(formatDateTime(generatedAt))}</div>
${child.birth_year !== null && child.birth_year !== undefined ? `<div class="meta">Birth year: ${child.birth_year}</div>` : ''}
${child.medications_note ? `<div class="meta">Medication note: ${e(child.medications_note)}</div>` : ''}`;

  const summary = `<h2>Summary</h2><div class="summary">
<div class="card"><b>${stats.total}</b>Total seizures</div>
${INTENSITIES.map(
  (k) =>
    `<div class="card"><b>${stats.byIntensity[k]}</b>${INTENSITY_META[k].glyph} ${INTENSITY_META[k].label}</div>`,
).join('\n')}
<div class="card"><b>${stats.avgPerWeek}</b>Average per week</div>
<div class="card"><b>${e(formatDuration(stats.longestDurationSeconds))}</b>Longest recorded duration</div>
</div>`;

  const chart = `<h2>Seizures per week</h2>${
    stats.total === 0
      ? '<p>No seizures recorded in this period.</p>'
      : buildWeeklyChartSvg(stats.weekly, 700, 220) + legendHtml()
  }`;

  const rows = events
    .map((ev) => {
      const d = new Date(ev.occurred_at);
      const m = INTENSITY_META[ev.intensity];
      const notes = [
        ev.notes ?? '',
        ev.context_tags.length ? `Context: ${ev.context_tags.map(contextTagLabel).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<tr><td>${e(formatDate(d))}</td><td>${e(formatTime(d))}</td><td>${m.glyph} ${m.label}</td><td>${e(formatDuration(ev.duration_seconds))}</td><td>${e(ev.symptoms.map((s) => s.label).join(', '))}</td><td>${e(afterEffectLabel(ev.after_effect))}</td><td>${e(notes)}</td></tr>`;
    })
    .join('\n');
  const log = `<h2>Detailed log</h2>${
    events.length === 0
      ? '<p>No seizures recorded in this period.</p>'
      : `<table><thead><tr><th>Date</th><th>Time</th><th>Intensity</th><th>Duration</th><th>Symptoms</th><th>After</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`
  }`;

  const top = stats.topSymptoms.slice(0, 10);
  const symptoms = `<h2>Most common symptoms</h2>${
    top.length === 0
      ? '<p>No symptoms recorded.</p>'
      : `<ol>${top.map((s) => `<li>${e(s.label)} — ${s.count}</li>`).join('')}</ol>`
  }`;

  const guideHtml = `<h2>Intensity definitions used</h2><div class="small">${INTENSITIES.map(
    (k) => `<div>${INTENSITY_META[k].glyph} <b>${INTENSITY_META[k].label}:</b> ${e(guide[k] ?? '')}</div>`,
  ).join('')}</div>`;

  const footer = `<div class="footer"><div>${e(REPORT_FOOTER)}</div><div>${e(EMERGENCY_DISCLAIMER)}</div></div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Seizure log — ${e(child.display_name)}</title><style>${CSS}</style></head><body>
${header}
${summary}
${chart}
${log}
${symptoms}
${guideHtml}
${footer}
</body></html>`;
}
