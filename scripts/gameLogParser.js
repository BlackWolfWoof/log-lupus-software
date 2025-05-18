// Import dependencies
import TailFile from "@logdna/tail-file";
import { createInterface } from "readline";
import { join } from "path";
import { userInfo } from "os";
import { logDebug, logInfo, logWarn, logError } from "./logger.js";
import { pushDataToWebSocket } from "./website.js";
import { sanetizeText, parseLocation, getNewestLogFile, processPlayerJoinedLog, processPlayerLeaveLog, processWorldJoin, checkUserGroups, checkAvatar, getUser, banUser } from "./functions.js";
import { playSound } from './say.js'

// Define `allUsers` as a global object
let allUsers = {};
let instanceInfo = {};
let banQueue = [] // Queue to match up displayName with allUser user id's and then execute a ban

// Default VRChat log path
const folderPath = join("C:", "Users", userInfo().username, "AppData", "LocalLow", "VRChat", "VRChat");

let logFile = getNewestLogFile(folderPath, "output_log_");
logDebug(`[Log Parser]: Logfile found, attaching. \x1b[4;37m${logFile}\x1b[0m`);
let tail = new TailFile(logFile);

/**
 * Returns the current state of allUsers.
 * @returns {Object} The allUsers object.
 */
export function getAllUsers() {
  return allUsers;
}

/**
 * Updates the allUsers object and pushes data to WebSocket clients.
 * @param {Object} updatedUsers - The new allUsers data.
 */
export function setAllUsers(updatedUsers) {
  allUsers = updatedUsers;
  pushDataToWebSocket(allUsers); // Push updates to WebSocket clients
}

// Set interval to check for new log file and reset user data
setInterval(async () => {
  const newLogFile = getNewestLogFile(folderPath, "output_log_");
  if (logFile !== newLogFile) {
    await tail.quit(); // Stop parsing of game log
    logDebug(`[Log Parser]: New logfile found, reloading. \x1b[4;37m${newLogFile}\x1b[0m`);
    allUsers = {};
    tail = new TailFile(newLogFile);
    doTail(); // Restart parsing of game log
  }
  logFile = newLogFile;
}, 5000);

// Start parsing the game logs
async function doTail() {
  tail.on("tail_error", (err) => {
    logError("[Log Parser]: TailFile encountered an error!", err);
    throw err;
  });

  try {
    await tail.start();
    const linesplitter = createInterface({
      input: tail
    });

    linesplitter.on("line", async (log) => {
    log = sanetizeText(log);

    // Player Join
    if (log.includes("[Behaviour] OnPlayerJoined") && !log.includes("] OnPlayerJoinedRoom")) {
      const userJoinData = processPlayerJoinedLog(log);
      // Ensure entry exists for the display name
      if (!allUsers[userJoinData.displayName]) {
          allUsers[userJoinData.displayName] = {
              user: { displayName: userJoinData.displayName },
              flaggedGroups: [],
              flaggedAvatars: [],
              avatars: [],
              joinedAt: Date.now()
          };
      } else {
          allUsers[userJoinData.displayName].joinedAt = Date.now();
      }
      // Fetch full user data (this is delayed because if the user leaves too fast after joining it will keep users in the list that have long left)
      const user = await getUser(userJoinData.userId, false);
      if (allUsers[userJoinData.displayName]) {
        allUsers[userJoinData.displayName].user = user
      } else {
        return
      }

      const filteredUsers = Object.fromEntries(
          Object.entries(allUsers).filter(([key, value]) => value.user?.id)
      );

      logInfo(`[Log Parser]: ${userJoinData.userId} - ${userJoinData.displayName} joined (${Object.keys(filteredUsers).length})`);

      // Fetch groups
      const checkGroups = (await checkUserGroups(user.id)) || [];
      if (!allUsers[userJoinData.displayName]) {
        return
      }
      allUsers[userJoinData.displayName].flaggedGroups = checkGroups

      // **Priority-based group selection**
      const groupPriority = [
          { key: "type", value: "SPECIAL" },
          { key: "banOnSight", value: true },
          { key: "type", value: "TOXIC" },
          { key: "type", value: "WATCH" },
          { key: "type", value: "PARTNER" }
      ];

      let flaggedGroupMessage = null;
      let shouldPlaySound = false;
      let isBos = false;
      
      for (const priority of groupPriority) {
        if (!allUsers[user.displayName]) return; // If entry doesn't exist, bail
    
        const matchingGroups = allUsers[user.displayName]?.flaggedGroups.filter(
            group => group[priority.key] === priority.value
        );
    
        if (matchingGroups.length > 0) {
          // Prioritize banOnSight > TOXIC > WATCH
          if (!flaggedGroupMessage || priority.key === "banOnSight") {
            const prioritizedGroup = matchingGroups.find(group => group.priority === true);
            const selectedGroup = prioritizedGroup || matchingGroups[0];

            flaggedGroupMessage = selectedGroup.message;

            // Determine if the sound should be played
            if (priority.key === "banOnSight") {
                shouldPlaySound = true;
                isBos = true;
                break; // Stop immediately at the highest priority
            } else if (priority.value === "TOXIC" || priority.value === "WATCH") {
                shouldPlaySound = true;
                // Don't break yet—continue only if banOnSight isn't found
            }
          }
        }
      }

      // **Announce if the user is in a flagged group**
      if (shouldPlaySound) {
        if (isBos) {
          playSound(`Auto ban for ${user.displayName}, for ${flaggedGroupMessage}`, 'SFX_SIREN_CHIRP');
          await banUser(process.env["GROUP_ID"], user.id);
        } else {
          playSound(`${user.displayName}. ${flaggedGroupMessage}`, 'SFX_SIREN_CHIRP');
        }
      }

      setAllUsers(allUsers); // Update WebSocket clients
    }


      // Player Leave
      if (log.includes("[Behaviour] OnPlayerLeft") && !log.includes("] OnPlayerLeftRoom")) {
        const userLeaveData = processPlayerLeaveLog(log);

        delete allUsers[userLeaveData.displayName]; // Remove user entry

        if (userLeaveData) {
          const filteredUsers = Object.fromEntries(
            Object.entries(allUsers).filter(([key, value]) => value.user?.id)
          );

          logInfo(`[Log Parser]: ${userLeaveData.userId} - ${userLeaveData.displayName} left (${Object.keys(filteredUsers).length})`);
        }

        setAllUsers(allUsers); // Update WebSocket clients
      }

      // Avatar Handling
      if (log.includes("[Behaviour] Switching ") && log.includes(" to avatar ")) {
        const start = log.indexOf("[Behaviour] Switching ") + "[Behaviour] Switching ".length;
        const end = log.lastIndexOf(" to avatar ");

        if (start > 0 && end > start) {
          const displayName = log.substring(start, end).trim();
          const avatarName = log.substring(end + " to avatar ".length).trim();

          // Ensure entry exists for the user in `allUsers`
          if (!allUsers[displayName]) {
            allUsers[displayName] = {
              user: {
                displayName: displayName
              },
              flaggedGroups: [],
              flaggedAvatars: [],
              avatars: [],
              joinedAt: Date.now()
            };
          }

          // Get avatar history reference
          const userData = allUsers[displayName];

          // Only add the avatar if it's different from the last one in the history
          if (userData.avatars && (userData.avatars.length === 0 || userData.avatars[userData.avatars.length - 1] !== avatarName)) {
            userData.avatars.push(avatarName);

            // Check if the avatar is flagged
            const aviCheck = checkAvatar(avatarName);
            logInfo(`[Log Parser]: ${displayName} switched to ${avatarName}`);

            if (aviCheck && !userData.flaggedAvatars.includes(aviCheck)) {
              userData.flaggedAvatars.push(aviCheck);
              if (aviCheck.banOnSight === "true") {
                playSound(`Auto ban for ${displayName}, for switching into the avatar ${avatarName} which is a ${aviCheck.type} avatar.`,'SFX_SIREN_CHIRP')
                banQueue.push(displayName) // The user will be banned as soon as the user id is found
              } else {
                playSound(`${displayName}. switched into the avatar ${avatarName} which is a ${aviCheck.type} avatar.`,'SFX_SIREN_CHIRP')
              }
              
              logDebug(`[Log Parser]: ${displayName}'s flagged avatars:\n${JSON.stringify(userData.flaggedAvatars, null, 2)}`);
            }
          }
        }

        setAllUsers(allUsers); // Update WebSocket clients
      }

      // Changing lobbies
      // const instance = log.match(/(.+) Debug\s+-\s+\[Behaviour\] Joining (or Creating Room: (.+)|(.+))$/);
      // if (instance) {
      //   if (instance[3]) {
      //     // World name
      //     instanceInfo["worldName"] = instance[3];
      //   } else if (instance[2]) {
      //     // Instance
      //     const newInstanceInfo = await parseLocation(instance[2]);
      //     instanceInfo = {
      //       ...instanceInfo,
      //       ...newInstanceInfo
      //     };
      //   } else {
      //     logError("[Log Parser]: Failed to obtain instance info from logfile");
      //   }
      //   setAllUsers(allUsers); // Update WebSocket clients
      // }

      const instance = log.includes('[Behaviour] Joining wrld_') || log.includes('[Behaviour] Joining or Creating Room:')
      if (instance) {
        const locationInfo = processWorldJoin(log)
        if (locationInfo.worldName) {
          instanceInfo["worldName"] = locationInfo.worldName
        } else if (locationInfo.locationString) {
          // Instance
          const newInstanceInfo = await parseLocation(locationInfo.locationString);
          instanceInfo = {
            ...instanceInfo,
            ...newInstanceInfo
          };
          // instanceInfo = newInstanceInfo
        } else {
          console.error("[Log Parser]: Failed to obtain instance info from logfile");
        }
        setAllUsers(allUsers); // Update WebSocket clients
      }

    });
  } catch (err) {
    logError(`[Log Parser]: Cannot start the log reader. Does the file exist? ${err}`);
    throw err;
  }
}

doTail(); // Start parsing of game log


// Ban user if found and matched
let interval = setInterval(async () => {
  const newQueue = [];
  
  for (const value of banQueue) {
    if (allUsers[value]?.user?.id) {
      try {
        await banUser(process.env["GROUP_ID"], allUsers[value].user.id);
      } catch (e) {
        console.error(e);
        newQueue.push(value); // Keep in queue if banning fails
      }
    } else {
      newQueue.push(value); // Keep user if they don't exist
    }
  }

  banQueue = newQueue; // Update the queue after processing
}, 5000); // 5s
