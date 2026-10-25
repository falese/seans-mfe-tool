import { parseJourneys, describeStep, readJourneysFile } from '../journeys';

describe('parseJourneys', () => {
  it('reads a YAML journey file', () => {
    const journeys = parseJourneys(`
journeys:
  - name: docking-review
    steps:
      - goto: /docking
      - click: "text=Docking"
      - fill: { selector: "#q", value: "VR" }
      - press: { selector: "#q", key: Enter }
      - wait: 250
`);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].name).toBe('docking-review');
    expect(journeys[0].steps.map(describeStep)).toEqual([
      'goto /docking',
      'click text=Docking',
      'fill #q',
      'press Enter on #q',
      'wait 250ms',
    ]);
  });

  it('reads the same shape as JSON', () => {
    const journeys = parseJourneys('{"journeys":[{"name":"a","steps":[{"goto":"/"}]}]}');
    expect(journeys[0].steps).toEqual([{ goto: '/' }]);
  });

  it('rejects a step with no known action, naming the journey and step', () => {
    expect(() => parseJourneys('journeys:\n  - name: bad\n    steps:\n      - hover: "#x"\n')).toThrow(/bad.*step 1/);
  });

  it('rejects journey names that cannot be file names, and duplicates', () => {
    expect(() => parseJourneys('journeys:\n  - name: "a/b"\n    steps: [{ goto: / }]\n')).toThrow(/name/);
    expect(() =>
      parseJourneys('journeys:\n  - name: a\n    steps: [{ goto: / }]\n  - name: a\n    steps: [{ goto: / }]\n')
    ).toThrow(/duplicate/i);
  });
});

describe('readJourneysFile', () => {
  it('names the flag and the path when the file is not there', async () => {
    await expect(readJourneysFile('/nowhere/meridian-journeys.yaml')).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('--journeys /nowhere/meridian-journeys.yaml: no such file'),
    });
  });
});
