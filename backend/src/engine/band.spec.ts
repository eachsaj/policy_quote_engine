import { findBand } from './band';
import { kbWith } from './test-kb';

const { orderedBands } = kbWith({});

describe('findBand', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each<[number, string]>([
    [0, 'STANDARD'],
    [25, 'STANDARD'],
    [26, 'ELEVATED'],
    [60, 'ELEVATED'],
    [61, 'HIGH_RISK'],
    [999, 'HIGH_RISK'],
  ])('score %i → %s', (score, band) => {
    expect(findBand(score, orderedBands).id).toBe(band);
  });

  it('keeps a score above the top max in the top band and warns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(findBand(1000, orderedBands).id).toBe('HIGH_RISK');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('score above top band max'));
  });

  it('does not warn inside a band', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    findBand(61, orderedBands);
    expect(warn).not.toHaveBeenCalled();
  });

  it('carries the KB multiplier and label', () => {
    expect(findBand(61, orderedBands)).toMatchObject({ riskMultiplier: 2.2, label: 'HIGH RISK' });
  });
});
