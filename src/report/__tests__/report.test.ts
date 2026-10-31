/// <reference types="jest" />
import { buildReportHtml, escapeHtml } from '../reportHtml';
import { buildCsv } from '../csv';
import { DEFAULT_INTENSITY_GUIDE, REPORT_FOOTER } from '../../constants';
import { ev } from '../../lib/testUtils';
import type { Child } from '../../types';

const child: Child = {
  id: 'c', owner_id: 'o', display_name: '<b>Al & "Bo"</b>', birth_year: 2019,
  medications_note: 'Keppra <5mg>', intensity_guide: null, last_visit_date: null,
  created_at: '', updated_at: '', deleted_at: null,
};
const from = new Date(2026, 9, 1);
const to = new Date(2026, 9, 30, 23, 59, 59, 999);

describe('reportHtml', () => {
  const events = [
    ev('1', new Date(2026, 9, 5, 2, 30), 'low', { notes: '<script>x</script>', context_tags: ['poor_sleep'] }),
    ev('2', new Date(2026, 9, 6, 2, 30), 'high'),
    ev('3', new Date(2026, 9, 7, 2, 30), 'high'),
  ];
  const html = buildReportHtml({ child, events, from, to, generatedAt: new Date(2026, 9, 30, 9, 0), guide: DEFAULT_INTENSITY_GUIDE });
  it('escapes and includes content', () => {
    expect(html).toContain('&lt;b&gt;Al &amp; &quot;Bo&quot;&lt;/b&gt;');
    expect(html).not.toContain('<b>Al');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('Contexte : Mauvais sommeil');
    expect(html).toContain('<svg');
    expect(html).toContain(escapeHtml(REPORT_FOOTER));
    expect(html).toContain('<b>3</b>Total des crises');
    expect(html).toContain('<b>2</b>▲'.replace('▲', '■'));
    expect(html).toContain('<b>1</b>● Légère');
    expect(html).toContain('<b>0</b>▲ Modérée');
  });
  it('empty', () => {
    const h = buildReportHtml({ child, events: [], from, to, generatedAt: new Date(), guide: DEFAULT_INTENSITY_GUIDE });
    expect(h).toContain('Aucune crise enregistrée');
  });
});

describe('csv', () => {
  it('bom, header, quoting, injection', () => {
    const out = buildCsv([
      ev('2', new Date(2026, 9, 6, 8, 0), 'high', { notes: '=cmd|x' }),
      ev('1', new Date(2026, 9, 5, 2, 30), 'low', {
        notes: 'a,b "q"\nline', duration_seconds: 90, symptoms: [{ id: '1', label: 'Jerking' }, { id: '2', label: 'Drooling' }],
      }),
    ]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1).startsWith('date,time,intensity,duration_seconds,duration,symptoms,after_effect,context,notes\r\n')).toBe(true);
    expect(out).toContain('"a,b ""q""\nline"');
    expect(out).toContain('Jerking; Drooling');
    expect(out).toContain(",'=cmd|x");
    expect(out.indexOf('2026-10-05')).toBeLessThan(out.indexOf('2026-10-06'));
  });
});
