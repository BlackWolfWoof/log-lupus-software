// Main file to initialize the code
import { readdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { logDebug, logError } from "./scripts/logger.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handler to load all files in the scripts folder
async function loadScripts() {
  try {
    const scriptPath = path.join(__dirname, 'scripts');
    const files = await readdir(scriptPath);

    for (const file of files) {
      if (file.endsWith('.js')) {
        await import(pathToFileURL(path.join(scriptPath, file)));
        logDebug(`[Handler]: ✅ Loaded \x1b[4;37m${file}\x1b[0m`);
      }
    }
  } catch (error) {
    logError('[Handler]: ❌ Error loading scripts')
    throw error
  }
}

loadScripts();