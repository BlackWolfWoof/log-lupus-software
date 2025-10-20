import say from 'say';
import sound from 'sound-play';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import removeAccents from 'remove-accents';
import clean from 'js-string-cleaner';
import { logDebug, logInfo, logWarn, logError } from './logger.js'

// Manually define __dirname for ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to SFX folder
const SFX_FOLDER = path.join(__dirname, '../sfx');

// Queue system
const queue = [];
let isProcessing = false;

/**
 * Function to queue up text-to-speech and/or an audio file.
 * @param {string} text - The text to be spoken.
 * @param {string} [audioFile] - Optional sound file (without extension) to play before speaking.
 */
export function playSound(text, audioFile = null) {
  if (!text) {
    logError('Error: No text provided.');
    return;
  }

  queue.push({ text, audioFile });

  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Function to process the queue sequentially.
 */
function processQueue() {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const { text, audioFile } = queue.shift();

  if (audioFile) {
    playAudio(audioFile)
      .then(() => speakText(text))
      .then(() => setTimeout(processQueue, 500)); // Short delay before next item
  } else {
    speakText(text).then(() => setTimeout(processQueue, 500));
  }
}

/**
 * Function to speak text using text-to-speech.
 * @param {string} text - The text to be spoken.
 * @returns {Promise<void>}
 */
function speakText(text) {
  return new Promise((resolve) => {
    logDebug(`[Say] Spoke: ${clean(removeAccents(text))}`)
    say.speak(clean(removeAccents(text)), 'Microsoft Zira Desktop', 1.2, (err) => {
      if (err) {
        logError(`[Say]: Speaking blew up :(`)
        console.error(err);
      }
      resolve();
    });
  });
}

/**
 * Function to play an audio file from the SFX folder.
 * @param {string} fileName - The name of the audio file (without extension).
 * @returns {Promise<boolean>} - Resolves true if file was played, false otherwise.
 */
async function playAudio(fileName) {
  const extensions = ['.mp3', '.wav'];
  for (const ext of extensions) {
    const filePath = path.join(SFX_FOLDER, fileName + ext);
    if (fs.existsSync(filePath)) {
      try {
        await sound.play(filePath);
        return true;
      } catch (error) {
        logError('Error playing audio')
        console.error(error);
        return false;
      }
    }
  }
  logError(`Error: Sound file '${fileName}' not found.`)
  return false;
}
