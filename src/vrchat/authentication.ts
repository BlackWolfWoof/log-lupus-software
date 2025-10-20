import '../utils/loadEnv.js' 
import { VRChat } from "vrchat";
import { logInfo, logError, logWarn, logDebug } from "../utils/logger.js"
import Keyv from 'keyv';
import { KeyvFile } from 'keyv-file';

// Storage for data like 2fa and auth cookie
export const keyv = new Keyv({
  store: new KeyvFile({ filename: process.env["KEYV_FILE"] })
});
// console.log(keyv)

let vrchat = new VRChat({
  keyv,
  application: {
    name: process.env["CODENAME"],
    version: process.env["VERSION"],
    contact: process.env["CONTACT_EMAIL"]
  },
  authentication: {
    credentials: {
      username: process.env["VRCHAT_USERNAME"],
      password: process.env["VRCHAT_PASSWORD"],
      totpSecret: process.env["VRCHAT_TOTP_SEED"],
    }
  }
});


// Rate limit
const ratelimit = Number(process.env["API_DELAY"])
const authQueue = [];
const normalQueue = [];
let isProcessing = false;

function processQueue() {
  const next = authQueue.length > 0
    ? authQueue.shift()
    : normalQueue.length > 0
      ? normalQueue.shift()
      : null;

  if (!next) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  next(); // execute the queued function

  setTimeout(() => {
    processQueue();
  }, ratelimit);
}

vrchat.client.interceptors.request.use((request) => {
  return new Promise((resolve) => {
    const handler = () => resolve(request);

    // Check if request is an auth request
    if (request.url.startsWith("https://api.vrchat.cloud/api/1/auth")) {
      authQueue.push(handler);
    } else {
      normalQueue.push(handler);
    }

    if (!isProcessing) {
      processQueue();
    }
  });
});



// API Log
vrchat.client.interceptors.response.use((response) => {

  const errorMessage = ``;

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

  logDebug(`[VRChat API]: ${colorCode}[${response.status}]\x1b[0m \x1b[4;37m${response.url}\x1b[0m${errorMessage}`);
  return response;

})


const { data: user } = await vrchat.getCurrentUser()
logInfo(`Logged in as ${user.displayName}.`)
export { vrchat }