import { describe, it, expect } from 'vitest';
import { ageColor } from '../../src/lib/age-color-css';

describe('ageColor', () => {
  it('returns text-text-tertiary when age is null', () => {
    expect(ageColor('EXECUTION', null)).toBe('text-text-tertiary');
  });

  it('returns text-text-tertiary for EXECUTION at 0m', () => {
    expect(ageColor('EXECUTION', 0)).toBe('text-text-tertiary');
  });

  it('returns text-text-tertiary for EXECUTION at 119m', () => {
    expect(ageColor('EXECUTION', 119)).toBe('text-text-tertiary');
  });

  it('returns text-amber for EXECUTION at 120m (boundary)', () => {
    expect(ageColor('EXECUTION', 120)).toBe('text-amber');
  });

  it('returns text-red for EXECUTION at 480m (boundary)', () => {
    expect(ageColor('EXECUTION', 480)).toBe('text-red');
  });

  it('returns text-amber for REVIEW_PENDING at 60m (boundary)', () => {
    expect(ageColor('REVIEW_PENDING', 60)).toBe('text-amber');
  });

  it('returns text-red for REVIEW_PENDING at 180m (boundary)', () => {
    expect(ageColor('REVIEW_PENDING', 180)).toBe('text-red');
  });

  it('returns text-amber for CONTEXT at 240m (boundary)', () => {
    expect(ageColor('CONTEXT', 240)).toBe('text-amber');
  });

  it('returns text-red for CONTEXT at 720m (boundary)', () => {
    expect(ageColor('CONTEXT', 720)).toBe('text-red');
  });

  it('returns text-amber for UNKNOWN_STATE at 200m (default threshold 180)', () => {
    expect(ageColor('UNKNOWN_STATE', 200)).toBe('text-amber');
  });

  it('returns text-red for UNKNOWN_STATE at 480m (default threshold)', () => {
    expect(ageColor('UNKNOWN_STATE', 480)).toBe('text-red');
  });
});
