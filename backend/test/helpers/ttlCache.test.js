import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { createTtlCache } = require('../../helpers/ttlCache');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createTtlCache', () => {
  it('calls the loader on a miss and caches the value', async () => {
    const cache = createTtlCache(60_000);
    const loader = vi.fn(async () => 'value');

    expect(await cache.get('k', loader)).toBe('value');
    expect(await cache.get('k', loader)).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL expires', async () => {
    const cache = createTtlCache(60_000);
    const loader = vi.fn(async () => 'value');

    await cache.get('k', loader);
    vi.advanceTimersByTime(61_000);
    await cache.get('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps keys independent', async () => {
    const cache = createTtlCache(60_000);
    const a = vi.fn(async () => 'a');
    const b = vi.fn(async () => 'b');

    expect(await cache.get('a', a)).toBe('a');
    expect(await cache.get('b', b)).toBe('b');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('clear() empties everything', async () => {
    const cache = createTtlCache(60_000);
    const loader = vi.fn(async () => 'value');

    await cache.get('k', loader);
    cache.clear();
    await cache.get('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('propagates loader failures without caching them', async () => {
    const cache = createTtlCache(60_000);
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.get('k', loader)).rejects.toThrow('db down');
    expect(await cache.get('k', loader)).toBe('recovered');
  });
});
