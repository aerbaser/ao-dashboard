import { describe, it, expect } from 'vitest';
import { getAgeColor } from '../../src/lib/age-color';
import type { PipelineState } from '../../src/lib/types';

describe('getAgeColor', () => {
  it('returns neutral when age is null', () => {
    expect(getAgeColor('EXECUTION', null)).toBe('neutral');
    expect(getAgeColor('REVIEW_PENDING', null)).toBe('neutral');
    expect(getAgeColor('CONTEXT', null)).toBe('neutral');
    expect(getAgeColor('DONE', null)).toBe('neutral');
  });

  // EXECUTION / SETUP: green <120m, amber 120–479m, red >=480m
  describe('EXECUTION / SETUP thresholds', () => {
    const states: PipelineState[] = ['EXECUTION', 'SETUP'];
    for (const state of states) {
      it(`${state}: green at 0m`, () => {
        expect(getAgeColor(state, 0)).toBe('green');
      });
      it(`${state}: green at 119m`, () => {
        expect(getAgeColor(state, 119)).toBe('green');
      });
      it(`${state}: amber at 120m (boundary)`, () => {
        expect(getAgeColor(state, 120)).toBe('amber');
      });
      it(`${state}: amber at 479m`, () => {
        expect(getAgeColor(state, 479)).toBe('amber');
      });
      it(`${state}: red at 480m (boundary)`, () => {
        expect(getAgeColor(state, 480)).toBe('red');
      });
      it(`${state}: red at 600m`, () => {
        expect(getAgeColor(state, 600)).toBe('red');
      });
    }
  });

  // REVIEW_PENDING / CI_PENDING: green <60m, amber 60–179m, red >=180m
  describe('REVIEW_PENDING / CI_PENDING thresholds', () => {
    const states: PipelineState[] = ['REVIEW_PENDING', 'CI_PENDING'];
    for (const state of states) {
      it(`${state}: green at 59m`, () => {
        expect(getAgeColor(state, 59)).toBe('green');
      });
      it(`${state}: amber at 60m (boundary)`, () => {
        expect(getAgeColor(state, 60)).toBe('amber');
      });
      it(`${state}: amber at 179m`, () => {
        expect(getAgeColor(state, 179)).toBe('amber');
      });
      it(`${state}: red at 180m (boundary)`, () => {
        expect(getAgeColor(state, 180)).toBe('red');
      });
    }
  });

  // CONTEXT / RESEARCH / DESIGN / PLANNING: green <240m, amber 240–719m, red >=720m
  describe('CONTEXT / RESEARCH / DESIGN / PLANNING thresholds', () => {
    const states: PipelineState[] = ['CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING'];
    for (const state of states) {
      it(`${state}: green at 239m`, () => {
        expect(getAgeColor(state, 239)).toBe('green');
      });
      it(`${state}: amber at 240m (boundary)`, () => {
        expect(getAgeColor(state, 240)).toBe('amber');
      });
      it(`${state}: amber at 719m`, () => {
        expect(getAgeColor(state, 719)).toBe('amber');
      });
      it(`${state}: red at 720m (boundary)`, () => {
        expect(getAgeColor(state, 720)).toBe('red');
      });
    }
  });

  // Default thresholds for other active states: amber >=180m, red >=480m
  describe('default thresholds (other states)', () => {
    const states: PipelineState[] = ['INTAKE', 'QUALITY_GATE', 'FINALIZING', 'DEPLOYING', 'OBSERVING'];
    for (const state of states) {
      it(`${state}: green at 179m`, () => {
        expect(getAgeColor(state, 179)).toBe('green');
      });
      it(`${state}: amber at 180m (boundary)`, () => {
        expect(getAgeColor(state, 180)).toBe('amber');
      });
      it(`${state}: red at 480m (boundary)`, () => {
        expect(getAgeColor(state, 480)).toBe('red');
      });
    }
  });

  // Terminal / error states still get age colors via default thresholds
  describe('terminal and error states use default thresholds', () => {
    const states: PipelineState[] = ['DONE', 'BLOCKED', 'FAILED', 'STUCK'];
    for (const state of states) {
      it(`${state}: green at 100m`, () => {
        expect(getAgeColor(state, 100)).toBe('green');
      });
      it(`${state}: amber at 200m`, () => {
        expect(getAgeColor(state, 200)).toBe('amber');
      });
      it(`${state}: red at 500m`, () => {
        expect(getAgeColor(state, 500)).toBe('red');
      });
    }
  });
});
