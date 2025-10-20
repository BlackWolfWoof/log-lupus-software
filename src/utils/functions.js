// A list of functions exported and re-used everyehere
import './loadEnv.js'
import { vrchat } from '../vrchat/authentication.ts'
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { parseGroups } from './flaggedGroups.js'
import { parseAvatars } from './flaggedAvatars.js'
import { wss } from "./website.js";
import { flushCache, hasCache, deleteCache, getCache, setCache, getUserGroups, getGroup } from './cache.js'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

// Defining some variables used in the entire code
const CACHE_EXPIRE = parseInt(process.env["CACHE_EXPIRE"] || "5") * 60 * 1000 // Convert minutes to milliseconds


/**
 * Sanetizes the text from special symbols VRChat introduces.
 * @param {string} text - String.
 * @returns {string} - Sanetized string.
 */
export function sanetizeText(text) {
  if (!text) {
    return ""
  }
  var symbolList = {
    "＠": "@",
    "＃": "#",
    "＄": "$",
    "％": "%",
    "＆": "&",
    "＝": "=",
    "＋": "+",
    "⁄": "/",
    "＼": "\\",
    ";": ";",
    "˸": ":",
    "‚": ",",
    "？": "?",
    "ǃ": "!",
    '＂': '"',
    "≺": "<",
    "≻": ">",
    "․": ".",
    "＾": "^",
    "｛": "{",
    "｝": "}",
    "［": "[",
    "］": "]",
    "（": "(",
    "）": ")",
    "｜": "|",
    "∗": "*"
  }
  var newText = text
  for (var key in symbolList) {
    var regex = new RegExp("\\" + key, "g") // Escape the key for special characters
    newText = newText.replace(regex, symbolList[key])
  }
  return newText.replace(/ {1,}/g, " ").trimEnd()
}

/**
 * Parses a VRChat location tag and extracts relevant information about the instance.
 *
 * @async
 * @function parseLocation
 * @param {string} tag - The VRChat location tag to be parsed.
 * @returns {Promise<ParsedLocation>} A promise that resolves to an object containing parsed location details.
 *
 * @example
 * const locationInfo = await parseLocation("wrld_ba913a96-fac4-4048-a062-9aa5db092812:12345~hidden(usr_1234)~region(us)")
 * console.log(locationInfo.worldId) // Outputs: "wrld_ba913a96-fac4-4048-a062-9aa5db092812"
 *
 * @typedef {Object} ParsedLocation
 * @property {string} tag - The original location tag.
 * @property {boolean} isOffline - Whether the user is offline.
 * @property {boolean} isPrivate - Whether the instance is private.
 * @property {boolean} isTraveling - Whether the user is traveling.
 * @property {boolean} isRealInstance - Whether this is a real instance (not local).
 * @property {string} worldId - The world ID associated with the tag.
 * @property {string} instanceId - The instance ID within the world.
 * @property {string} instanceName - The name of the instance.
 * @property {string} accessType - The access level of the instance ("public", "invite", "friends", etc.).
 * @property {string} accessTypeName - The detailed access type, including group-related types.
 * @property {string} region - The server region of the instance.
 * @property {string} shortName - The short name of the instance, if applicable.
 * @property {string|null} userId - The user ID associated with the access type (e.g., the inviter).
 * @property {string|null} hiddenId - The user ID if the instance is "Friends of Guests" access.
 * @property {string|null} privateId - The user ID if the instance is private.
 * @property {string|null} friendsId - The user ID if the instance is "Friends Only".
 * @property {string|null} groupId - The group ID if the instance is a group world.
 * @property {string|null} groupName - The name of the group (fetched from the API if applicable).
 * @property {string|null} groupAccessType - The access type for the group instance.
 * @property {boolean} canRequestInvite - Whether the user can request an invite.
 * @property {boolean} strict - Whether strict instance rules apply.
 * @property {boolean} ageGate - Whether the instance has an age restriction.
 */
export async function parseLocation(tag) {
  var _tag = String(tag || '')
  var ctx = {
    tag: _tag,
    isOffline: false,
    isPrivate: false,
    isTraveling: false,
    isRealInstance: false,
    worldId: '',
    instanceId: '',
    instanceName: '',
    accessType: '',
    accessTypeName: '',
    region: '',
    shortName: '',
    userId: null,
    hiddenId: null,
    privateId: null,
    friendsId: null,
    groupId: null,
    groupAccessType: null,
    canRequestInvite: false,
    strict: false,
    ageGate: false
  }
  if (_tag === 'offline' || _tag === 'offline:offline') {
    ctx.isOffline = true
  } else if (_tag === 'private' || _tag === 'private:private') {
    ctx.isPrivate = true
  } else if (_tag === 'traveling' || _tag === 'traveling:traveling') {
    ctx.isTraveling = true
  } else if (!_tag.startsWith('local')) {
    ctx.isRealInstance = true
    var sep = _tag.indexOf(':')
    // technically not part of instance id, but might be there when coping id from url so why not support it
    var shortNameQualifier = '&shortName='
    var shortNameIndex = _tag.indexOf(shortNameQualifier)
    if (shortNameIndex >= 0) {
      ctx.shortName = _tag.substr(
        shortNameIndex + shortNameQualifier.length
      )
      _tag = _tag.substr(0, shortNameIndex)
    }
    if (sep >= 0) {
      ctx.worldId = _tag.substr(0, sep)
      ctx.instanceId = _tag.substr(sep + 1)
      ctx.instanceId.split('~').forEach((s, i) => {
        if (i) {
          var A = s.indexOf('(')
          var Z = A >= 0 ? s.lastIndexOf(')') : -1
          var key = Z >= 0 ? s.substr(0, A) : s
          var value = A < Z ? s.substr(A + 1, Z - A - 1) : ''
          if (key === 'hidden') {
            ctx.hiddenId = value
          } else if (key === 'private') {
            ctx.privateId = value
          } else if (key === 'friends') {
            ctx.friendsId = value
          } else if (key === 'canRequestInvite') {
            ctx.canRequestInvite = true
          } else if (key === 'region') {
            ctx.region = value
          } else if (key === 'group') {
            ctx.groupId = value
          } else if (key === 'groupAccessType') {
            ctx.groupAccessType = value
          } else if (key === 'strict') {
            ctx.strict = true
          } else if (key === 'ageGate') {
            ctx.ageGate = true
          }
        } else {
          ctx.instanceName = s
        }
      })
      ctx.accessType = 'public'
      if (ctx.privateId !== null) {
        if (ctx.canRequestInvite) {
          // InvitePlus
          ctx.accessType = 'invite+'
        } else {
          // InviteOnly
          ctx.accessType = 'invite'
        }
        ctx.userId = ctx.privateId
      } else if (ctx.friendsId !== null) {
        // FriendsOnly
        ctx.accessType = 'friends'
        ctx.userId = ctx.friendsId
      } else if (ctx.hiddenId !== null) {
        // FriendsOfGuests
        ctx.accessType = 'friends+'
        ctx.userId = ctx.hiddenId
      } else if (ctx.groupId !== null) {
        // Group
        ctx.accessType = 'group'
        // ctx.groupName = (await getGroup(ctx.groupId)).name
        const group = await getGroup({
          path: { groupId: ctx.groupId }
        })
        ctx.groupName = group.data.name
      }
      ctx.accessTypeName = ctx.accessType
      if (ctx.groupAccessType !== null) {
        if (ctx.groupAccessType === 'public') {
          ctx.accessTypeName = 'groupPublic'
        } else if (ctx.groupAccessType === 'plus') {
          ctx.accessTypeName = 'groupPlus'
        }
      }
    } else {
      ctx.worldId = _tag
    }
  }
  return ctx
}


/**
 * Gets the newest file in a folder that starts with a specified prefix.
 * 
 * @param {string} folder - The path to the folder to search in.
 * @param {string} prefix - The prefix that the target files should start with.
 * @returns {string|null} The full path of the newest matching file, or `null` if no matching files are found.
 */
export function getNewestLogFile(folder, prefix) {
  const files = readdirSync(folder)
    .filter(file => file.startsWith(prefix))
    .map(file => ({
      name: file,
      time: statSync(join(folder, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time) // Sort by modification time, descending

  return files.length > 0 ? join(folder, files[0].name) : null
}


/**
 * Processes a log line to extract player information when they join.
 * 
 * @param {string} line - The log line containing player join information.
 * @returns {Object|boolean} Returns an object with `displayName` and `userId` if successfully parsed, otherwise returns `true` to indicate no valid data was found.
 */
export function processPlayerJoinedLog(line) {
  let lineOffset = line.lastIndexOf("[Behaviour] OnPlayerJoined ");

  if (lineOffset < 0) return true;

  lineOffset += 27;
  if (lineOffset > line.length) return true;

  const userInfo = line.substring(lineOffset)

  const extractUserId = s => s.slice(s.lastIndexOf("(usr_") + 1, s.lastIndexOf(")")) || "";

  return { displayName: userInfo.slice(0, -43), userId: extractUserId(userInfo) };
}


/**
 * Processes a log line to extract player information when they leave.
 * 
 * @param {string} line - The log line containing player leave information.
 * @returns {Object|boolean} Returns an object with `displayName` and `userId` if successfully parsed, otherwise returns `true` to indicate no valid data was found.
 */
export function processPlayerLeaveLog(line) {
  // Future logs will be formatted like this: 
  // [Behaviour] OnPlayerJoined Natsumi-sama (usr_032383a7-748c-4fb2-94e4-bcb928e5de6b)

  let lineOffset = line.lastIndexOf("[Behaviour] OnPlayerLeft ");

  if (lineOffset < 0) return true;

  lineOffset += 25;
  if (lineOffset > line.length) return true;

  const userInfo = line.substring(lineOffset)

  const extractUserId = s => s.slice(s.lastIndexOf("(usr_") + 1, s.lastIndexOf(")")) || "";

  return {displayName: userInfo.slice(0, -43), userId: extractUserId(userInfo)};
}


/**
 * Processes a log line related to joining a world or creating a room.
 *
 * This function checks if the given log line contains information about joining a world
 * (identified by `wrld_`) or joining/creating a room. It then extracts the relevant world 
 * name or location string accordingly.
 *
 * @param {string} line - The log line to process.
 * @returns {{worldName: string | null, locationString: string | null} | true} 
 * Returns an object containing:
 * - `worldName` (string | null): The name of the world if joining/creating a room, otherwise null.
 * - `locationString` (string | null): The location string if joining a `wrld_`, otherwise null.
 * Returns `true` if no relevant data is found.
 */
export function processWorldJoin(line) {
  if (line.includes('[Behaviour] Joining wrld_')) {
    let lineOffset = line.lastIndexOf("[Behaviour] Joining wrld_");

    if (lineOffset < 0) return true;

    lineOffset += 19;
    if (lineOffset > line.length) return true;

    const locationString = line.substring(lineOffset);
    return { worldName: null, locationString: locationString };

  } else if (line.includes('[Behaviour] Joining or Creating Room: ')) {
    let lineOffset = line.lastIndexOf("[Behaviour] Joining or Creating Room: ");

    if (lineOffset < 0) return true;

    lineOffset += 38;
    if (lineOffset > line.length) return true;

    const worldName = line.substring(lineOffset);
    return { worldName: worldName, locationString: null };
  }
}


/**
 * Retrieves flagged groups for a given user.
 * @param {string} userId - The user's ID.
 * @returns {Promise<Array>} - Array of objects containing groupId, Type, BanOnSight, and Priority.
 */
export async function checkUserGroups(userId) {
  // const userGroups = await getUserGroups(userId); // Fetch user groups
  const userGroups = await getUserGroups({
    path: { userId: userId }
  })
  const userGroupIds = userGroups.data.map(group => group.groupId); // Extract group IDs
  const parsedGroups = parseGroups(); // Fetch reference group data

  return parsedGroups
    .filter(group => userGroupIds.includes(group["Group Id"])) // Find matching groups
    .map(group => {
      const userGroup = userGroups.data.find(ug => ug.groupId === group["Group Id"]); // Find the user's group details

      return {
        groupName: userGroup.name,
        groupId: group["Group Id"],
        type: group["Type"],
        banOnSight: group["Ban On Sight"] === "true",
        priority: group["Priority"] === "true",
        tags: group["Tag-Set"] ? group["Tag-Set"].split(";") : [],
        message: group["Message"]
      };
    });
}


/**
 * Checks if an avatar name exists in the parsed CSV data.
 * @param {string} avatarName - The name of the avatar to check.
 * @returns {Object|null} - Returns relevant avatar info or null if not found.
 */
export function checkAvatar(avatarName) {
  const foundAvatar = parseAvatars().find(avatar => avatar["Name"] === avatarName)
  if (foundAvatar) {
    return {
      banOnSight: foundAvatar["Ban On Sight"],
      type: foundAvatar["Type"],
      name: foundAvatar["Name"],
      avatarId: foundAvatar["AvatarNode Id"]
    }
  }

  return null // Returns null if no match is found
}


/**
 * Sends the complete allUsers object to all connected WebSocket clients.
 * This function should be called whenever allUsers is updated.
 *
 * @function pushDataToWebSocket
 * @param {Object} allUsers - The updated user data to send to clients.
 * @returns {void}
 */
export function pushDataToWebSocket(allUsers) {
  if (!wss || wss.clients.size === 0) {
    logWarn("[Web]: No active WebSocket clients to send data.");
    return;
  }

  try {
    const dataString = JSON.stringify(allUsers);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(dataString);
      }
    });

    logDebug("[Web]: Pushed full allUsers data to WebSocket clients.");
  } catch (error) {
    logError(`[Web]: Error while pushing data to WebSocket:\n${error}`);
  }
}