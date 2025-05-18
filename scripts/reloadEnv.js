// Reloads the .env file if it changes. This will have to be called manually
import dotenv from 'dotenv'
import { logDebug } from "./logger.js"

export function reloadEnv() {
  // Clear current environment variables
  Object.keys(process.env).forEach(key => {
    if (key in process.env) delete process.env[key]
  })

  // Reload dotenv
  dotenv.config()

  logDebug('🔄 .env file reloaded')
}

// Initial load
dotenv.config()