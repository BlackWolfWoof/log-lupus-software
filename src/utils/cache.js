import NodeCache from 'node-cache';
import { vrchat } from '../vrchat/authentication.ts'

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });


// Cache utilities
export async function setCache(key, value, ttl = 3600) {
  await cache.set(key, value, ttl);
}
export async function getCache(key) {
  return await cache.get(key);
}
export async function deleteCache(key) {
  await cache.del(key);
}
export async function hasCache(key) {
  return await cache.has(key);
}
export async function flushCache() {
  await cache.flushAll();
}


function toSafeJSON(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`; // Mark it as BigInt string
    }
    return value;
  });
}

function fromSafeJSON(json) {
  return JSON.parse(json, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1)); // Remove "n" and convert back to BigInt
    }
    return value;
  });
}



const priorityQueues = new Map();
const priorities = [];

function insertPriority(priority) {
  if (!priorities.includes(priority)) {
    priorities.push(priority);
    priorities.sort((a, b) => b - a);
  }
}

function enqueueRequest(priority, request) {
  if (!priorityQueues.has(priority)) {
    priorityQueues.set(priority, []);
    insertPriority(priority);
  }
  priorityQueues.get(priority).push(request);
}

function dequeueRequest() {
  for (const priority of priorities) {
    const queue = priorityQueues.get(priority);
    if (queue.length > 0) {
      const req = queue.shift();
      if (queue.length === 0) {
        priorityQueues.delete(priority);
        const index = priorities.indexOf(priority);
        if (index !== -1) priorities.splice(index, 1);
      }
      return req;
    }
  }
  return null;
}

async function processQueue() {
  while (true) {
    const req = dequeueRequest();
    if (!req) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    try {
      await req.handler();
    } catch (err) {
      console.error('Error processing request:', err);
    }
  }
}

processQueue();

// GENERIC wrapper function for caching + priority queue
export async function cachedPriorityQueueFetch(cacheKey, priority, fetchFn, ttl = 3600, cache = true) {
  if (cache) {
    let cached = await getCache(cacheKey)
    if (cached !== undefined) {
      // Return cached immediately, but enqueue a refresh/update in background
      // enqueueRequest(priority, {
      //   handler: async () => {
      //     try {
      //       const freshData = await fetchFn();
      //       await setCache(cacheKey, toSafeJSON(freshData), ttl);
      //     } catch (err) {
      //       console.error('Error refreshing cache for', cacheKey, err);
      //     }
      //   }
      // });
      return fromSafeJSON(cached);
    } else {
      // No cache, enqueue fetch and wait for result
      return new Promise((resolve, reject) => {
        enqueueRequest(priority, {
          handler: async () => {
            try {
              const freshData = await fetchFn();
              await setCache(cacheKey, toSafeJSON(freshData), ttl);
              resolve(freshData);
            } catch (err) {
              reject(err);
            }
          }
        });
      });
    }
  } else {
    // Skip cache completely — enqueue fetch and wait for result, but optionally cache result
    return new Promise((resolve, reject) => {
      enqueueRequest(priority, {
        handler: async () => {
          try {
            const freshData = await fetchFn();
            // Cache it anyway, or skip caching if you want
            await setCache(cacheKey, toSafeJSON(freshData), ttl);
            resolve(freshData);
          } catch (err) {
            reject(err);
          }
        }
      });
    });
  }
}





// API function using generic caching + queue system
export async function getUser(object, priority = 5, useCache = true) {
  return cachedPriorityQueueFetch(
    `getUser_${JSON.stringify(object)}`,
    priority,
    () => vrchat.getUser(object),
    3600,
    useCache
  );
}

export async function getCurrentUser(object, priority = 5, useCache = true) {
  return cachedPriorityQueueFetch(
    `getCurrentUser_${JSON.stringify(object)}`,
    priority,
    () => vrchat.getCurrentUser(object),
    3600,
    useCache
  );
}

export async function getGroup(object, priority = 5, useCache = true) {
  return cachedPriorityQueueFetch(
    `getGroup_${JSON.stringify(object)}`,
    priority,
    () => vrchat.getGroup(object),
    3600,
    useCache
  );
}

export async function banGroupMember(object, priority = 8, useCache = false) {
    return cachedPriorityQueueFetch(
    `banGroupMember_${JSON.stringify(object)}`,
    priority,
    () => vrchat.banGroupMember(object),
    3600,
    useCache
  );
}

export async function getUserGroups(object, priority = 5, useCache = true) {
    return cachedPriorityQueueFetch(
    `getUserGroups_${JSON.stringify(object)}`,
    priority,
    () => vrchat.getUserGroups(object),
    3600,
    useCache
  );
}