/// <reference types="jest" />
import { formatDuration, symptomSummary } from '../format';

describe('format', () => {
  it('formatDuration', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(90)).toBe('1 – 2 min');
    expect(formatDuration(45)).toBe('30 sec – 1 min');
    expect(formatDuration(50)).toBe('50 sec');
    expect(formatDuration(125)).toBe('2 min 5 sec');
    expect(formatDuration(180)).toBe('3 min');
  });
  it('symptomSummary', () => {
    expect(symptomSummary(['Jerking', 'Drooling'])).toBe('Jerking, Drooling');
    expect(symptomSummary(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2');
  });
});
