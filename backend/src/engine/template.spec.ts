import { interpolate, templateTokens } from './template';

describe('template', () => {
  it('lists tokens in order', () => {
    expect(templateTokens('{label}: {factorCount} factor(s), score {score}')).toEqual(['label', 'factorCount', 'score']);
  });

  it('fills known tokens and leaves unknown ones as written', () => {
    expect(interpolate('{label} ({score}) {nope}', { label: 'ELEVATED', score: 30 })).toBe('ELEVATED (30) {nope}');
  });
});
