import './loadEnv.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js';
import { initAuthentication } from './authentication.js';

let vrchatToken = process.env["VRCHAT_TOKEN"] || ""

export function getVrchatToken() {
  return vrchatToken
}

export async function setVrchatToken(token) {
  vrchatToken = token
  try {
    let data = await fs.readFile(".env", "utf-8")
    data = data.replace(/VRCHAT_TOKEN=.*/, `VRCHAT_TOKEN=auth=${token}`) // Update token
    await fs.writeFile(".env", data)
    logDebug(`[Auth]: Credentials saved successfully.`)
  } catch (err) {
    logError(`[Auth]: Error updating credentials`)
    throw err
  }
}

const requestQueue = [];
let isProcessing = false;
const API_DELAY = parseInt(process.env["API_DELAY"], 10) || 1000; // Default 1 second
let lastApiCallTime = 0; // Timestamp of last API request

/**
 * Drop-in replacement for fetch() that queues requests with priority.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options (method, headers, body, etc.).
 * @param {number} [priority=5] - Priority level (higher executes first).
 * @returns {Promise<Response>} - Resolves with the fetch response.
 */
export async function vrchatFetch(url, options = {}, priority = 5) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject, priority });

    if (!isProcessing) {
      processQueue();
    }
  });
}

/**
 * Processes the queue: executes requests one by one while enforcing rate limits and priority.
 */
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    // Sort queue by priority (higher values first)
    requestQueue.sort((a, b) => b.priority - a.priority);
    const { url, options, resolve, reject } = requestQueue.shift();

    // Calculate time to wait before the next request
    const now = Date.now();
    const waitTime = Math.max(0, lastApiCallTime + API_DELAY - now);

    if (waitTime > 0) {
      await new Promise((r) => setTimeout(r, waitTime));
    }

    try {
      // Inject the current cookie dynamically
      const originalHeaders = options.headers || {};
      const updatedHeaders = {
        ...originalHeaders,
        ...(originalHeaders["Cookie"] ? {} : { "Cookie": getVrchatToken() }),
        ...(originalHeaders["User-Agent"] ? {} : { "User-Agent": process.env["USERAGENT"] }),
      };

      const updatedOptions = {
        ...options,
        headers: updatedHeaders
      };
      const response = await fetch(url, updatedOptions);
      // console.log(`${url}\n${JSON.stringify(updatedOptions, null, 2)}`)
      lastApiCallTime = Date.now(); // Update last API call timestamp

      const responseClone = response.clone(); // Clone response before reading body
      let errorMessage = "";
      
      try {
        const jsonResponse = await responseClone.json(); // Try parsing as JSON
        if (jsonResponse.error && jsonResponse.error.message) {
          errorMessage = ` - ${jsonResponse.error.message}`;
        }
      } catch (parseError) {
        // Ignore JSON parse errors, response might not be JSON
      }

      // Determine color based on response status using switch-case
      let colorCode = "\x1b[0m"; // Default reset color
      switch (true) {
        case response.status >= 200 && response.status < 300:
          colorCode = "\x1b[1;32m"; // Bright Green for 200s
          break;
        case response.status >= 300 && response.status < 400:
          colorCode = "\x1b[1;34m"; // Bright Blue for 300s
          break;
        case response.status >= 400 && response.status < 500:
          colorCode = "\x1b[1;33m"; // Bright Yellow for 400s
          break;
        case response.status >= 500:
          colorCode = "\x1b[1;31m"; // Bright Red for 500s
          break;
      }

      logDebug(`[VRChat API]: ${colorCode}[${response.status}]\x1b[0m \x1b[4;37m${url}\x1b[0m${errorMessage}`);
      resolve(response);
    } catch (error) {
      logError(`[VRChat API]: \x1b[4;37m${url}\x1b[0m failed due to ${error}`);
      reject(error);
    }
  }

  isProcessing = false;
}

(async () => {
  await initAuthentication();
})();