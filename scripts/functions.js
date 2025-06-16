// A list of functions exported and re-used everyehere
import './loadEnv.js'
import { testSession } from './authentication.js'
import { vrchatFetch } from './apiQueue.js'
import { logDebug, logInfo, logWarn, logError } from './logger.js'
import { parseGroups } from './flaggedGroups.js'
import { parseAvatars } from './flaggedAvatars.js'
import { wss } from "./website.js";
import { flushCache, hasCache, deleteCache, getCache, setCache } from './cache.js'
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
 * Retrieves information about a VRChat group from the API, with caching support.
 *
 * @async
 * @function getGroup
 * @param {string} groupId - The unique identifier of the VRChat group.
 * @returns {Promise<Object>} A promise that resolves to an object containing group details.
 *
 * @example
 * const groupInfo = await getGroup("grp_71a7ff59-112c-4e78-a990-c7cc650776e5")
 * console.log(groupInfo.name) // Outputs the group name
 *
 * @typedef {Object} VRChatGroup
 * @property {boolean} ageVerificationSlotsAvailable - Whether age verification slots are available.
 * @property {string} ageVerificationBetaCode - The beta code for age verification.
 * @property {number} ageVerificationBetaSlots - The number of beta slots available.
 * @property {string[]} badges - List of badges assigned to the group.
 * @property {string} id - The group's unique identifier.
 * @property {string} name - The name of the group.
 * @property {string} shortCode - The short code identifier for the group.
 * @property {string} discriminator - Group discriminator.
 * @property {string} description - A brief description of the group.
 * @property {string} iconUrl - URL to the group's icon.
 * @property {string} bannerUrl - URL to the group's banner.
 * @property {string} privacy - Privacy setting of the group (e.g., "default").
 * @property {string} ownerId - The user ID of the group's owner.
 * @property {string} rules - The group's rules.
 * @property {string[]} links - Associated external links.
 * @property {string[]} languages - Supported languages in the group.
 * @property {string} iconId - ID of the group's icon.
 * @property {string} bannerId - ID of the group's banner.
 * @property {number} memberCount - Total number of members in the group.
 * @property {string} memberCountSyncedAt - Timestamp when member count was last synced.
 * @property {boolean} isVerified - Whether the group is verified.
 * @property {string} joinState - Current join state of the group (e.g., "closed").
 * @property {string[]} tags - List of associated tags.
 * @property {string} transferTargetId - User ID of a potential transfer target.
 * @property {VRChatGallery[]} galleries - List of associated galleries.
 * @property {string} createdAt - Timestamp of group creation.
 * @property {string} updatedAt - Timestamp of last group update.
 * @property {string} lastPostCreatedAt - Timestamp of the last post creation.
 * @property {number} onlineMemberCount - Number of online members.
 * @property {string} membershipStatus - The membership status of the current user.
 * @property {VRChatMember} myMember - The current user's membership details.
 * @property {VRChatRole[]} roles - List of roles within the group.
 *
 * @typedef {Object} VRChatGallery
 * @property {string} id - The gallery's unique identifier.
 * @property {string} name - The name of the gallery.
 * @property {string} description - Description of the gallery.
 * @property {boolean} membersOnly - Whether the gallery is restricted to members.
 * @property {string[]} roleIdsToView - Roles that can view the gallery.
 * @property {string[]} roleIdsToSubmit - Roles that can submit to the gallery.
 * @property {string[]} roleIdsToAutoApprove - Roles that can auto-approve submissions.
 * @property {string[]} roleIdsToManage - Roles that can manage the gallery.
 * @property {string} createdAt - Timestamp of gallery creation.
 * @property {string} updatedAt - Timestamp of last gallery update.
 *
 * @typedef {Object} VRChatMember
 * @property {string} id - The member's unique identifier.
 * @property {string} groupId - ID of the group the member belongs to.
 * @property {string} userId - The user's unique identifier.
 * @property {string[]} roleIds - List of role IDs assigned to the member.
 * @property {string} acceptedByDisplayName - Display name of the user who accepted them.
 * @property {string} acceptedById - ID of the user who accepted them.
 * @property {string} createdAt - Timestamp of membership creation.
 * @property {string} managerNotes - Notes from the group manager.
 * @property {string} membershipStatus - Membership status (e.g., "member").
 * @property {boolean} isSubscribedToAnnouncements - Whether subscribed to announcements.
 * @property {string} visibility - Visibility status of the member.
 * @property {boolean} isRepresenting - Whether the member is representing the group.
 * @property {string} joinedAt - Timestamp when the user joined.
 * @property {string} bannedAt - Timestamp when the user was banned (if applicable).
 * @property {boolean} has2FA - Whether the member has two-factor authentication enabled.
 * @property {boolean} hasJoinedFromPurchase - Whether joined via purchase.
 * @property {string} lastPostReadAt - Timestamp when last post was read.
 * @property {string[]} mRoleIds - List of role IDs the member has.
 * @property {string[]} permissions - List of permissions granted.
 *
 * @typedef {Object} VRChatRole
 * @property {string} id - The role's unique identifier.
 * @property {string} groupId - The ID of the group the role belongs to.
 * @property {string} name - The name of the role.
 * @property {string} description - Description of the role.
 * @property {boolean} isSelfAssignable - Whether the role can be self-assigned.
 * @property {string[]} permissions - List of permissions associated with the role.
 * @property {boolean} isManagementRole - Whether the role is a management role.
 * @property {boolean} requiresTwoFactor - Whether the role requires two-factor authentication.
 * @property {boolean} requiresPurchase - Whether the role requires a purchase.
 * @property {number} order - Order of the role in hierarchy.
 * @property {string} createdAt - Timestamp of role creation.
 * @property {string} updatedAt - Timestamp of last role update.
 */
export async function getGroup(groupId, useCache = true) {
  // Check cache
  const cachedData = await getCache(groupId)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for group ${groupId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}`, {
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(groupId, data)
      break
    case 401:
      await testSession()
      data = await getGroup(groupId)
      break
  }

  return data
}


/**
 * @typedef {Object} VRChatUser
 * @property {string} id - The unique identifier of the user.
 * @property {string} displayName - The display name of the user.
 * @property {string} thumbnailUrl - The URL of the user's thumbnail image.
 * @property {string} iconUrl - The URL of the user's icon image.
 * @property {string} profilePicOverride - The overridden profile picture URL.
 * @property {string} currentAvatarThumbnailImageUrl - The URL of the user's current avatar thumbnail.
 * @property {string[]} currentAvatarTags - An array of tags associated with the user's current avatar.
 */

/**
 * @typedef {Object} GroupMember
 * @property {string} acceptedByDisplayName - The display name of the person who accepted the user into the group.
 * @property {string} acceptedById - The ID of the person who accepted the user.
 * @property {string} id - The unique identifier of the group membership.
 * @property {string} groupId - The ID of the group.
 * @property {string} userId - The ID of the user.
 * @property {boolean} isRepresenting - Whether the user is representing the group.
 * @property {VRChatUser} user - The user object containing additional details.
 * @property {string[]} roleIds - An array of role IDs assigned to the user.
 * @property {string[]} mRoleIds - An array of moderator role IDs assigned to the user.
 * @property {string} joinedAt - The timestamp when the user joined the group.
 * @property {string} membershipStatus - The membership status (e.g., "member").
 * @property {string} visibility - The visibility status of the membership.
 * @property {boolean} isSubscribedToAnnouncements - Whether the user is subscribed to group announcements.
 * @property {string} createdAt - The timestamp when the membership was created.
 * @property {string} bannedAt - The timestamp when the user was banned, if applicable.
 * @property {string} managerNotes - Notes added by a manager.
 * @property {string} lastPostReadAt - The timestamp of the last post the user read.
 * @property {boolean} hasJoinedFromPurchase - Whether the user joined via a purchase.
 */

/**
 * Bans a user from a VRChat group.
 *
 * @async
 * @param {string} groupId - The ID of the group.
 * @param {string} userId - The ID of the user to ban.
 * @returns {Promise<Object>} The response data from the VRChat API.
 */
export async function banUser(groupId, userId) {
  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/groups/${groupId}/bans`, {
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    body: JSON.stringify({ userId: userId })
  }, 10); // Max priority

  let data = await response.json();

  // Check request status
  switch (response.status) {
    case 200:
    case 400:
    case 403:
      break;
    case 401:
      await testSession();
      data = await banUser(groupId, userId);
      break;
  }

  return data;
}



/**
 * Retrieves information about a VRChat user from the API, with caching support.
 *
 * @async
 * @function getUser
 * @param {string} userId - The unique identifier of the VRChat user.
 * @returns {Promise<VRChatUser>} A promise that resolves to an object containing user details.
 *
 * @example
 * const userInfo = await getUser("usr_c1644b5b-3ca4-45b4-97c6-a2a0de70d469")
 * console.log(userInfo.displayName) // Outputs the user's display name
 *
 * @typedef {Object} VRChatUser
 * @property {string} ageVerificationStatus - Age verification status ("hidden", "verified", etc.).
 * @property {boolean} ageVerified - Whether the user is age verified.
 * @property {boolean} allowAvatarCopying - Whether the user allows avatar copying.
 * @property {VRChatBadge[]} badges - List of badges assigned to the user.
 * @property {string} bio - User's biography.
 * @property {string[]} bioLinks - List of links in the user's bio.
 * @property {string} currentAvatarImageUrl - URL to the user's current avatar.
 * @property {string} currentAvatarThumbnailImageUrl - URL to the user's avatar thumbnail.
 * @property {string[]} currentAvatarTags - Tags associated with the user's avatar.
 * @property {string} date_joined - The date the user joined VRChat.
 * @property {string} developerType - User's developer type (e.g., "none").
 * @property {string} displayName - The user's display name.
 * @property {string} friendKey - Key used for friend-related actions.
 * @property {string} friendRequestStatus - Status of a friend request (if applicable).
 * @property {string} id - The user's unique identifier.
 * @property {string} instanceId - The current instance ID the user is in.
 * @property {boolean} isFriend - Whether the user is a friend.
 * @property {string} last_activity - Timestamp of the user's last activity.
 * @property {string} last_login - Timestamp of the user's last login.
 * @property {string} last_mobile - Timestamp of the last mobile login.
 * @property {string} last_platform - The last platform used (e.g., "standalonewindows").
 * @property {string} location - The world or instance the user is currently in.
 * @property {string} note - A user-defined note about this user.
 * @property {string} platform - The platform the user is currently using.
 * @property {string} profilePicOverride - URL of a custom profile picture.
 * @property {string} profilePicOverrideThumbnail - URL of the profile picture thumbnail.
 * @property {string} pronouns - The user's preferred pronouns.
 * @property {string} state - The user's current online state (e.g., "offline").
 * @property {string} status - The user's account status (e.g., "active").
 * @property {string} statusDescription - A description of the user's current status.
 * @property {string[]} tags - A list of tags associated with the user.
 * @property {string} travelingToInstance - The instance the user is traveling to.
 * @property {string} travelingToLocation - The location the user is traveling to.
 * @property {string} travelingToWorld - The world the user is traveling to.
 * @property {string} userIcon - URL of the user's profile icon.
 * @property {string} worldId - The ID of the world the user is in.
 *
 * @typedef {Object} VRChatBadge
 * @property {string} assignedAt - Timestamp when the badge was assigned.
 * @property {string} badgeDescription - Description of the badge.
 * @property {string} badgeId - The unique identifier of the badge.
 * @property {string} badgeImageUrl - URL to the badge image.
 * @property {string} badgeName - The name of the badge.
 * @property {boolean} hidden - Whether the badge is hidden.
 * @property {boolean} showcased - Whether the badge is showcased.
 * @property {string} updatedAt - Timestamp when the badge was last updated.
 */
export async function getUser(userId, useCache = true) {
  // Check cache
  const cachedData = await getCache(userId)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached data for user ${userId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/users/${userId}`, {
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(userId, data)
      break
    case 401:
      await testSession()
      data = await getUser(userId, useCache)
      break
    case 404:
      break
  }

  return data
}


/**
 * Retrieves a list of VRChat groups the user is a member of, with caching support.
 *
 * @async
 * @function getUserGroups
 * @param {string} userId - The unique identifier of the VRChat user.
 * @returns {Promise<VRChatUserGroup[]>} A promise that resolves to an array of user group objects.
 *
 * @example
 * const userGroups = await getUserGroups("usr_c1644b5b-3ca4-45b4-97c6-a2a0de70d469")
 * console.log(userGroups[0].name) // Outputs the name of the first group
 *
 * @typedef {Object} VRChatUserGroup
 * @property {string} id - The unique identifier of the user group membership.
 * @property {string} name - The name of the group.
 * @property {string} shortCode - The group's short code.
 * @property {string} discriminator - Group discriminator.
 * @property {string} description - A brief description of the group.
 * @property {string} iconId - The ID of the group's icon.
 * @property {string} iconUrl - URL to the group's icon.
 * @property {string} bannerId - The ID of the group's banner.
 * @property {string} bannerUrl - URL to the group's banner.
 * @property {string} privacy - Privacy setting of the group.
 * @property {string} lastPostCreatedAt - Timestamp of the last post created in the group.
 * @property {string} ownerId - The user ID of the group's owner.
 * @property {number} memberCount - The total number of members in the group.
 * @property {string} groupId - The unique identifier of the group.
 * @property {string} memberVisibility - Visibility status of the user within the group.
 * @property {boolean} isRepresenting - Whether the user is representing this group.
 * @property {boolean} mutualGroup - Whether the group is mutual between friends.
 * @property {string} lastPostReadAt - Timestamp when the last post was read.
 */
export async function getUserGroups(userId, useCache = true) {
  // Check cache
  const cachedData = await getCache(`${userId}_group`)
  if (cachedData && useCache) {
    logDebug(`[Cache]: Returning cached group data for user ${userId}`)
    return cachedData
  }

  // Fetch new data from API
  const response = await vrchatFetch(`https://api.vrchat.cloud/api/1/users/${userId}/groups`, {
    method: "GET"
  })

  let data = await response.json()

  // Check request status
  switch (response.status) {
    case 200:
      // Store in cache
      await setCache(`${userId}_group`, data)
      break
    case 401:
      await testSession()
      data = await getUserGroups(userId, useCache)
      break
    case 404:
      break
  }

  return data
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
        ctx.groupName = (await getGroup(ctx.groupId)).name
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
  const userGroups = await getUserGroups(userId); // Fetch user groups
  const userGroupIds = userGroups.map(group => group.groupId); // Extract group IDs
  const parsedGroups = parseGroups(); // Fetch reference group data

  return parsedGroups
    .filter(group => userGroupIds.includes(group["Group Id"])) // Find matching groups
    .map(group => {
      const userGroup = userGroups.find(ug => ug.groupId === group["Group Id"]); // Find the user's group details

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