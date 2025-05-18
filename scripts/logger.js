import './loadEnv.js'
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getFormattedTime() {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`.replace(/\b(\d)\b/g, "0$1");
}

function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // +1 because months are zero-based
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `output_log_${year}.${month}.${day}-${hours}.${minutes}.${seconds}.log`;
}


const logFilePath = path.join(LOG_DIR, getLogFileName());
const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];
const LOGLEVEL = process.env["LOGLEVEL"]?.toUpperCase() || "INFO";
const MIN_LOG_LEVEL_INDEX = LOG_LEVELS.indexOf(LOGLEVEL);

const colorMap = {
  INFO: "\x1b[32m", // Green
  WARN: "\x1b[33m", // Yellow
  DEBUG: "\x1b[36m", // Cyan
  ERROR: "\x1b[31m" // Red
}
const resetColor = "\x1b[0m";

function log(level, message) {
  const levelIndex = LOG_LEVELS.indexOf(level);
  if (levelIndex >= MIN_LOG_LEVEL_INDEX) {
    const formattedTime = getFormattedTime()
    const logMessage = `[${formattedTime}]${colorMap[level] || ""}[${level}]:${resetColor} ${message}`
    console.log(logMessage)
    fs.appendFileSync(logFilePath, logMessage + "\n", "utf8");
  }
}

export const logInfo = (msg) => log("INFO", msg);
export const logWarn = (msg) => log("WARN", msg);
export const logDebug = (msg) => log("DEBUG", msg);
export const logError = (msg) => log("ERROR", msg);

function cleanupOldLogs() {
  const files = fs.readdirSync(LOG_DIR);
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  files.forEach(file => {
    const filePath = path.join(LOG_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > SEVEN_DAYS) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old log file: ${file}`);
      }
    } catch (err) {
      console.error(`Error checking file: ${file}`, err);
    }
  });
}

cleanupOldLogs();
