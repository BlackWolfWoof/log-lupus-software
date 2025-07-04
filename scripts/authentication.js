import './loadEnv.js'
import dotenv from "dotenv"; dotenv.config()
import fs from "fs/promises"
import { authenticator } from "otplib"
import { logInfo, logError, logWarn, logDebug } from "./logger.js"
import { vrchatFetch, setVrchatToken, getVrchatToken } from "./apiQueue.js"

// Utility sleep function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate a TOTP code using a seed.
 * @param {string} seed - The secret seed for generating OTP.
 * @returns {string} - Generated OTP code.
 */
function generateOTP(seed) {
  authenticator.options = {
    step: 30,
    digits: 6,
    algorithm: "sha1"
  }
  return authenticator.generate(seed)
}

/**
 * Send TOTP code for authentication.
 * @param {string} auth - Auth token from login.
 * @param {string} totpCode - Generated OTP code.
 * @returns {string} - Two-factor authentication token.
 */
async function getAuthTOTP(auth, totpCode) {
  const response = await vrchatFetch("https://api.vrchat.cloud/api/1/auth/twofactorauth/totp/verify", {
    headers: {
      "Content-Type": "application/json",
      "Cookie": `auth=${auth}`
    },
    method: "POST",
    credentials: "include",
    body: JSON.stringify({
      code: totpCode
    })
  }, 10) // Max priority

  // if (!response.ok) {
  //   logError(`HTTP error getAuthTOTP()! status: ${response.status}`)
  //   // throw new Error(`HTTP error! status: ${response.status}`)
  // }

  const authCookie2FA = response.headers.get("set-cookie")

  // Extract `twoFactorAuth` value from the cookie
  if (authCookie2FA) {
     return (authCookie2FA.match(/twoFactorAuth=([^;]*)/) || [])[1]
  } else {
    logError(`[Auth]: TOTP (2FA) seed invalid. Make sure you provided a valid 2fa seed.`)
    process.exit(1)
  }
}

/**
 * Create a new session with username and password.
 * @param {string} username - VRChat username.
 * @param {string} password - VRChat password.
 * @returns {string} - Auth token.
 */
async function createSession(username, password) {
  const auth = Buffer.from(`${encodeURIComponent(username)}:${encodeURIComponent(password)}`).toString("base64")
  const response = await vrchatFetch("https://api.vrchat.cloud/api/1/auth/user", {
    headers: {
      "Authorization": `Basic ${auth}`
    },
    method: "GET",
    credentials: "include"
  }, 10) // Max priority

  // if (!response.ok) {
  //   logError(`HTTP error createSession()! status: ${response.status}`)
  // }
  const cookie = response.headers.get("set-cookie")
  if (cookie) {
    return (cookie.match(/auth=([^;]*)/) || [])[1]
  }
   logError(`[Auth]: Login failed. Check your username and password.`)
   return null
}

/**
 * Handles an invalid authentication session by re-logging in.
 * Implements exponential backoff for failed attempts.
 */
async function authInvalid() {
  let attempts = 0
  let delay = 5000 // Start with 1 second

  while (attempts < 3) {
    try {
      logWarn(`[Auth]: Session invalid. Attempt ${attempts + 1}/3. Generating new session...`)

      const auth = await createSession(process.env["VRCHAT_USERNAME"], process.env["VRCHAT_PASSWORD"])
      if (!auth) process.exit(1)

      logDebug(`[Auth]: Generating TOTP code...`)
      const totpCode = generateOTP(process.env["TOTP_SEED"])

      logDebug(`[Auth]: Logging in with 2FA...`)
      const twoFactorAuth = await getAuthTOTP(auth, totpCode)

      logInfo(`[Auth]: Success. Saving credentials...`)
      await setVrchatToken(auth)

      dotenv.config() // Reload the updated credentials
      logInfo(`[Auth]: 🔄️ Reloaded env vars`)
      return // Exit the function if successful
    } catch (error) {
      logError(`[Auth]: Login attempt ${attempts + 1} failed: ${error.message}`)
      attempts++

      if (attempts >= 3) {
        logError("[Auth]: Maximum login attempts reached. Exiting...")
        process.exit(1)
      }

      logWarn(`[Auth]: Retrying in ${delay / 5000} seconds...`)
      await sleep(delay)
      delay *= 2 // Double the wait time for the next attempt
    }
  }
}


/**
 * Test the current VRChat session and refreshes it if needed.
 */
export async function testSession() {
  const response = await vrchatFetch("https://api.vrchat.cloud/api/1/auth/user", {
    method: "GET"
  }, 10) // Max priority
  // const data = await response.json()
  if (response.status === 401) await authInvalid()
}


// Auto-login when the script starts
export async function initAuthentication() {
  logInfo(`[Auth]: Logging in to VRChat...`)
  await testSession()
  logInfo(`[Auth]: Login success!`)
}
