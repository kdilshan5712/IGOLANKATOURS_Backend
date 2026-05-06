/**
 * 🎯 I GO LANKA TOURS - In-Memory Cache Service
 *
 * A simple, zero-dependency, module-level TTL cache.
 * Prevents redundant database queries for frequently-accessed,
 * infrequently-changing data (e.g. package listings, pricing rules).
 *
 * @module cache.service
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} value - The cached data.
 * @property {number} expiresAt - Unix timestamp (ms) when entry expires.
 */

/** @type {Map<string, CacheEntry>} */
const store = new Map();

const cacheService = {
  /**
   * Retrieves a cached value if it exists and has not expired.
   *
   * @param {string} key - Cache key.
   * @returns {*} The cached value, or null if missing/expired.
   */
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }

    return entry.value;
  },

  /**
   * Stores a value in the cache with a TTL.
   *
   * @param {string} key - Cache key.
   * @param {*} value - Data to cache.
   * @param {number} [ttlSeconds=60] - How long to keep the entry alive (in seconds).
   */
  set(key, value, ttlSeconds = 60) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  /**
   * Removes a specific key from the cache immediately.
   * Call this whenever admin mutations occur on the cached data.
   *
   * @param {string} key - Cache key to remove.
   */
  invalidate(key) {
    store.delete(key);
    console.log(`[Cache] Invalidated: "${key}"`);
  },

  /**
   * Removes all keys from the cache that start with a given prefix.
   * Useful for invalidating all filter variants of the same resource.
   *
   * @param {string} prefix - Key prefix to match.
   */
  invalidatePrefix(prefix) {
    let count = 0;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[Cache] Invalidated ${count} key(s) with prefix: "${prefix}"`);
    }
  },

  /**
   * Clears the entire cache.
   */
  flush() {
    store.clear();
    console.log("[Cache] Flushed all entries.");
  },

  /**
   * Returns the number of entries currently in the cache (including expired ones).
   * Useful for debugging.
   *
   * @returns {number}
   */
  size() {
    return store.size;
  },
};

export default cacheService;
