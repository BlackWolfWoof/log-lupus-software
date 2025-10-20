import './src/utils/loadEnv.js'
import { readdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { logDebug, logError } from "./src/utils/logger.js";

// Listen for SIGINT (CTRL+C)
process.on('SIGINT', () => {
  console.log('[Main Handler]: Received SIGINT (CTRL+C). Cleaning up...');
  process.exit(0); // Exit gracefully (replace this when logic for this is in place)
});

// Listen for SIGTERM (kill command)
process.on('SIGTERM', () => {
  console.log('[Main Handler]: Received SIGTERM. Shutting down...');
  process.exit(0);
});

// Get the directory of the current file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively loads all JavaScript files from a given directory, except the Discord folder.
 * @param {string} dirPath - The directory to scan for script files.
 * @param {string} basePath - The base path to calculate relative paths.
 */
async function loadScripts(dirPath, basePath) {
  try {
    const files = await readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);

      // Skip the discord folder since it has a separate handler
      if (file.isDirectory() && file.name !== 'discord') {
        await loadScripts(fullPath, basePath);
      } else if (file.isFile() && file.name.endsWith('.js') || file.name.endsWith('.ts')) {
        await import(pathToFileURL(fullPath));

        // Get the relative path from the base src directory
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
        logDebug(`[Main Handler]: ✅ Loaded \x1b[4;37m${relativePath}\x1b[0m`);
      }
    }
  } catch (error) {
    logError(`[Main Handler]: ❌ Error loading scripts from ${dirPath} - ${error.message}`);
    throw error
  }
}

// Start loading all scripts from src, except discord (handled separately)
const scriptsPath = path.join(__dirname, 'src');
await loadScripts(scriptsPath, scriptsPath);

logDebug("[Main Handler]: ✅ All handlers initialized.");