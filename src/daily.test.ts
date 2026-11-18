import { describe, expect, it } from 'vitest';
import { BOMB_SPAWN_CHANCE, clearCells, collapse, createBoard, type Grid } from './board';
import { drawCast } from './animals';
import {
  BOMB_RAIN_CHANCE,
  DAILY_KEEP_DAYS,
  DAILY_KEY,
  DAILY_MINUTES,
  addDays,
  dailyBest,
  dailyDate,
  formatDay,
  loadDaily,
  parseDaily,
  playedOn,
  recordDaily,
  saveDaily,
  seededRng,
  serializeDaily,
  streakOn,
  twistFor,
  twistRules,
  weekdayOf,
  type DailyRecord,
} from './daily';

const types = (g: Grid) => g.map((row) => row.map((gem) => gem?.type ?? -1));
const empty = (): DailyRecord => parseDaily(null);

/** A board for `date`, then one refill after clearing the top-left 3 cells, all from the day's generator. */
function playDay(date: string, rows = 8, cols = 8) {
  const rng = seededRng(date, rows, cols);
  const cast = drawCast(rng);
  const grid = createBoard(rows, cols, rng);
  const start = types(grid);
  clearCells(grid, [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]);
  collapse(grid, rng, BOMB_SPAWN_CHANCE);
  return { cast, start, after: types(grid) };
}

describe('dailyDate', () => {
  it('is the local calendar date, zero-padded', () => {
    expect(dailyDate(new Date(2026, 10, 18, 0, 0, 1))).toBe('2026-11-18');
    expect(dailyDate(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
  });
});

describe('seeded daily board', () => {
  it('gives the same cast, start board and refills for the same date and shape', () => {
    expect(playDay('2026-11-18')).toEqual(playDay('2026-11-18'));
    expect(playDay('2026-11-18', 8, 6)).toEqual(playDay('2026-11-18', 8, 6));
  });

  it('gives a different board on another date or another board shape', () => {
    expect(playDay('2026-11-19').start).not.toEqual(playDay('2026-11-18').start);
    const phone = playDay('2026-11-18', 8, 6).start;
    const desktop = playDay('2026-11-18', 8, 8).start;
    expect(phone.map((r) => r.join())).not.toEqual(desktop.map((r) => r.slice(0, 6).join()));
  });

  it('returns numbers in [0, 1)', () => {
    const rng = seededRng('2026-11-18', 8, 8);
    for (let i = 0; i < 2000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('weekday twists', () => {
  it('reads the weekday from the date itself, whatever the time zone', () => {
    expect(weekdayOf('2026-11-15')).toBe(0); // Sunday
    expect(weekdayOf('2026-11-18')).toBe(3); // Wednesday
  });

  it('follows the agreed schedule', () => {
    // 2026-11-16 is a Monday.
    const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
    expect(week.map(twistFor)).toEqual(['classic', 'diagonal', 'bombRain', 'classic', 'diagonal', 'bombRain', 'both']);
  });

  it('turns twists into rules: diagonal matches and the bomb chance', () => {
    expect(BOMB_RAIN_CHANCE).toBeCloseTo(1 / 4);
    expect(twistRules('classic')).toEqual({ diagonal: false, bombChance: BOMB_SPAWN_CHANCE });
    expect(twistRules('diagonal')).toEqual({ diagonal: true, bombChance: BOMB_SPAWN_CHANCE });
    expect(twistRules('bombRain')).toEqual({ diagonal: false, bombChance: BOMB_RAIN_CHANCE });
    expect(twistRules('both')).toEqual({ diagonal: true, bombChance: BOMB_RAIN_CHANCE });
  });

  it('is always a 3-minute round', () => {
    expect(DAILY_MINUTES).toBe(3);
  });
});

describe('addDays', () => {
  it('crosses month and year ends and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daily record', () => {
  it('keeps the best score of each day; replays only raise it', () => {
    let rec = recordDaily(empty(), '2026-11-18', 5000);
    rec = recordDaily(rec, '2026-11-18', 3000);
    expect(dailyBest(rec, '2026-11-18')).toBe(5000);
    rec = recordDaily(rec, '2026-11-18', 7000);
    expect(dailyBest(rec, '2026-11-18')).toBe(7000);
    expect(dailyBest(rec, '2026-11-17')).toBe(0);
  });

  it('counts a finished round as played, even with no points', () => {
    const rec = recordDaily(empty(), '2026-11-18', 0);
    expect(playedOn(rec, '2026-11-18')).toBe(true);
    expect(playedOn(rec, '2026-11-17')).toBe(false);
  });

  it('does not change the record it is given', () => {
    const rec = recordDaily(empty(), '2026-11-18', 100);
    const copy = JSON.parse(JSON.stringify(rec));
    recordDaily(rec, '2026-11-19', 200);
    expect(rec).toEqual(copy);
  });
});

describe('streak', () => {
  const run = (dates: string[]) => dates.reduce((rec, d) => recordDaily(rec, d, 100), empty());

  it('counts consecutive days, across month and year ends', () => {
    const rec = run(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(streakOn(rec, '2027-01-02')).toBe(4);
    expect(streakOn(run(['2026-11-29', '2026-11-30', '2026-12-01']), '2026-12-01')).toBe(3);
  });

  it('counts a day once however often it is replayed', () => {
    expect(streakOn(run(['2026-11-17', '2026-11-18', '2026-11-18', '2026-11-18']), '2026-11-18')).toBe(2);
  });

  it('stays alive until the end of the day after the last daily, then shows 0', () => {
    const rec = run(['2026-11-17', '2026-11-18']);
    expect(streakOn(rec, '2026-11-19')).toBe(2);
    expect(streakOn(rec, '2026-11-20')).toBe(0);
  });

  it('starts again at 1 after a missed day', () => {
    expect(streakOn(run(['2026-11-15', '2026-11-16', '2026-11-18']), '2026-11-18')).toBe(1);
  });

  it('counts a round that crossed midnight for the day it started', () => {
    // Started on the 18th, finished after midnight: recorded for the 18th.
    const rec = run(['2026-11-17', '2026-11-18']);
    expect(streakOn(rec, '2026-11-19')).toBe(2);
    expect(playedOn(rec, '2026-11-19')).toBe(false);
  });

  it('ignores a late record for a day older than the streak', () => {
    let rec = run(['2026-11-17', '2026-11-18']);
    rec = recordDaily(rec, '2026-11-10', 100);
    expect(streakOn(rec, '2026-11-18')).toBe(2);
  });
});

describe('storage format', () => {
  it('round-trips', () => {
    const rec = recordDaily(recordDaily(empty(), '2026-11-17', 1200), '2026-11-18', 3400);
    expect(parseDaily(serializeDaily(rec))).toEqual(rec);
    expect(JSON.parse(serializeDaily(rec))).toEqual({
      v: 1,
      days: { '2026-11-17': 1200, '2026-11-18': 3400 },
      streak: { last: '2026-11-18', count: 2 },
    });
  });

  it('falls back to empty on missing or corrupt data, and drops bad entries', () => {
    for (const raw of [null, '', 'nope', '[]', '42', '{"v":2}', 'null']) {
      expect(parseDaily(raw), String(raw)).toEqual(empty());
    }
    const rec = parseDaily(
      JSON.stringify({
        v: 1,
        days: { '2026-11-18': 500, 'bad-date': 3, '2026-11-17': -4, '2026-11-16': 'x', '2026-11-15': 12.7 },
        streak: { last: 'yesterday', count: 3 },
      }),
    );
    expect(rec.days).toEqual({ '2026-11-18': 500, '2026-11-15': 12 });
    expect(rec.streak).toBeNull();
  });

  it(`keeps only the last ${DAILY_KEEP_DAYS} days`, () => {
    let rec = empty();
    for (let i = 0; i < 80; i++) rec = recordDaily(rec, addDays('2026-09-01', i), 10 + i);
    const days = Object.keys(rec.days).sort();
    expect(days.length).toBe(DAILY_KEEP_DAYS);
    expect(days.at(-1)).toBe(addDays('2026-09-01', 79));
    expect(streakOn(rec, addDays('2026-09-01', 79))).toBe(80); // the streak itself is kept
  });

  it('loads and saves under its own key, swallowing storage errors', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const rec = recordDaily(empty(), '2026-11-18', 900);
    saveDaily(() => store, rec);
    expect(DAILY_KEY).toBe('neon-cascade:daily');
    expect([...data.keys()]).toEqual([DAILY_KEY]);
    expect(loadDaily(() => store)).toEqual(rec);
    const broken = () => {
      throw new Error('blocked');
    };
    expect(loadDaily(broken)).toEqual(empty());
    expect(() => saveDaily(broken, rec)).not.toThrow();
  });
});

describe('formatDay', () => {
  it('names the date in the UI language, from the date itself', () => {
    expect(formatDay('2026-11-18', 'en', 'long')).toBe('Wednesday');
    expect(formatDay('2026-11-18', 'en', 'short')).toMatch(/Wed.*18.*Nov/);
    expect(formatDay('2026-11-18', 'zh-CN', 'long')).toBe('星期三');
    expect(formatDay('2026-11-18', 'zh-CN', 'short')).toMatch(/11月18日/);
  });
});
