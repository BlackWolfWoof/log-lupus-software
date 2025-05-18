import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { logDebug, logInfo, logWarn, logError } from "./logger.js";
import { getAllUsers } from "./gameLogParser.js"; // Import getAllUsers function
import { exec } from 'child_process';
import { QuickDB } from 'quick.db';
const db = new QuickDB();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ server });

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../public")));

// Parse JSON request bodies
app.use(express.json());

// WebSocket handling
wss.on("connection", (ws) => {
    // logDebug("[Web]: WebSocket connected");

    // Send the latest allUsers data to the newly connected client
    const allUsers = getAllUsers();
    if (Object.keys(allUsers).length > 0) {
        ws.send(JSON.stringify(allUsers));
        // logDebug("[Web]: Sent current allUsers data to newly connected client.");
    }

    // ws.on("close", () => logDebug("[Web]: WebSocket disconnected"));
});

/**
 * Sends the updated allUsers object to all connected WebSocket clients.
 * @function pushDataToWebSocket
 * @returns {void}
 */
export function pushDataToWebSocket() {
    if (!wss || wss.clients.size === 0) {
        // logWarn("[Web]: No active WebSocket clients to send data.");
        return;
    }

    const allUsers = getAllUsers(); // Get the latest allUsers data

    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(allUsers));
        }
    });

    // logDebug("[Web]: Pushed updated allUsers data to WebSocket clients.");
}

/**
 * API to get configuration data
 */
app.get('/api/getConfig', async (req, res) => {
  try {
    const avatarConfig = await db.get('avatarConfig');
    const groupConfig = await db.get('groupConfig');
    const miscConfig = await db.get('miscConfig');
    res.json({ avatarConfig, groupConfig, miscConfig });
  } catch (error) {
    logError('Error fetching config: ', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * API to save Avatar configuration data
 */
app.post('/api/saveAvatarConfig', async (req, res) => {
  try {
    const avatarConfig = req.body;
    await db.set("avatarConfig", avatarConfig);
    res.status(200).send('Avatar configuration saved');
  } catch (error) {
    logError('Error saving avatar config: ', error);
    res.status(500).json({ error: 'Failed to save avatar configuration' });
  }
});

/**
 * API to save Group configuration data
 */
app.post('/api/saveGroupConfig', async (req, res) => {
  try {
    const groupConfig = req.body;
    await db.set("groupConfig", groupConfig);
    res.status(200).send('Group configuration saved');
  } catch (error) {
    logError('Error saving group config: ', error);
    res.status(500).json({ error: 'Failed to save group configuration' });
  }
});

/**
 * API to save Misc config data
 */
app.post('/api/saveMiscConfig', async (req, res) => {
  try {
    const miscConfig = req.body;
    await db.set("miscConfig", miscConfig);
    res.status(200).send('Misc configuration saved');
  } catch (error) {
    logError('Error saving misc config: ', error);
    res.status(500).json({ error: 'Failed to save misc configuration' });
  }
});

const openBrowser = (url) => {
  switch (process.platform) {
    case 'darwin': // macOS
      exec(`open ${url}`);
      break;
    case 'win32': // Windows
      exec(`start ${url}`);
      break;
    case 'linux': // Linux
      exec(`xdg-open ${url}`);
      break;
    default:
      logError('[Web]: Unsupported platform, open browser manually and report this to the developer.')
  }
};

const PORT = process.env.PORT || 3000;

const url = `http://localhost:${PORT}`
openBrowser(url);
server.listen(PORT, () => logDebug(`[Web]: Server running at ${url}`));
