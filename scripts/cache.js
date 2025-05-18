// Caching related stuff
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // Default TTL: 1 hour, cleanup every 10 minutes

export async function setCache(key, value, ttl = 3600) { 
  await cache.set(key, value, ttl); // Set a custom TTL (time-to-live) for each key
};

export async function getCache(key) {
  return await cache.get(key);
};

export async function deleteCache(key) {
  await cache.del(key);
};

export async function hasCache(key) {
  return await cache.has(key);
};

export async function flushCache() {
  await cache.flushAll(); // Clears all cached data
};

// flushCache()