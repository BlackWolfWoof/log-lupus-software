const ws = new WebSocket(`ws://${window.location.host}`);

// Trust Level Colors
const trustColors = {
  untrusted: "#CCCCCC",
  basic: "#1778FF",
  known: "#2BCF5C",
  trusted: "#FF7B42",
  veteran: "#B18FFF",
  vip: "#FF2626",
  troll: "#782F2F"
};

// Status Emojis
const statusEmojis = {
  "join me": "🔵",
  "active": "🟢",
  "ask me": "🟠",
  "busy": "🔴"
};

// Store user list
let allUsers = {};
let selectedUser = null;

ws.onmessage = (event) => {
  allUsers = JSON.parse(event.data);
  updateUserList();
};

/**
 * Updates the user list display and ensures the left panel is always showing a user.
 */
const updateUserList = () => {
  const userList = document.getElementById("user-list");
  userList.innerHTML = ""; // Clear existing list

  const usersArray = Object.values(allUsers);

  // Keep the previously selected user if they still exist
  const previousSelectedUserId = selectedUser?.user?.id;
  if (!previousSelectedUserId || !allUsers[previousSelectedUserId]) {
    selectedUser = null; // Do not auto-select any user
  }

  usersArray.forEach(({ user, flaggedGroups, joinedAt, flaggedAvatars, avatars }) => {
    if (!user.id) return; // Ignore users without an ID
    const displayName = user?.displayName || "Unknown User";

    // Join time
    const joinedTime = joinedAt ? new Date(joinedAt) : null;
    let timeInInstance = "N/A";

    if (joinedTime) {
      const diffMs = Date.now() - joinedTime.getTime();
      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      timeInInstance = hours > 0 ? `${hours}h${remainingMinutes}m` : `${remainingMinutes}m`;
    }

    // Avatar
    const thumbnail = user?.profilePicOverride ||
      user?.currentAvatarThumbnailImageUrl ||
      user?.currentAvatarImageUrl ||
      "robot.jpg";

    // Account age
    const dateJoined = user?.date_joined ? new Date(user.date_joined) : null;
    const daysSinceJoin = dateJoined ?
      Math.floor((Date.now() - dateJoined.getTime()) / (1000 * 60 * 60 * 24)) :
      null;

    // Trusted rank
    const { trustColor } = getUserTrustLevel(user);

    // Platform
    const platform = user?.last_platform?.toLowerCase().includes("android") ?
      `<span class="platform-Android">A</span>` :
      user?.last_platform ? `<span class="platform-PC">PC</span>` : "";

    // ⚠️ Determine user div border (based on flaggedGroups)
    let borderColor = "transparent"; // Default no border
    let isStriped = false;

    if (flaggedGroups?.length > 0) {
      let highestPriorityColor = null; // Track highest priority color

      flaggedGroups.forEach(group => {
        if (group.type === "SPECIAL") {
          highestPriorityColor = "#8A2BE2"; // Purple (highest priority)
        } else if (group.banOnSight) {
          highestPriorityColor = "red"; // Ban on Sight (highest priority)
        } else {
          switch (group.type) {
            case "TOXIC":
              highestPriorityColor = highestPriorityColor || "#FF8C00"; // Orange (high priority)
              break;
            case "WATCH":
              highestPriorityColor = highestPriorityColor || "#FFD700"; // Yellow (low priority)
              break;
            case "PARTNER":
              highestPriorityColor = highestPriorityColor || "#32CD32"; // Green (lowest priority)
              break;
          }
        }

        // If group has priority, mark it striped
        if (group.priority) {
          isStriped = true;
        }
      });

      // Set final border color based on highest priority
      borderColor = highestPriorityColor || "black"; // Default to black if no color assigned
    }

    // Apply user div border style
    const borderThickness = "5px";
    const borderStyle = isStriped
      ? `border: ${borderThickness} dashed ${borderColor};`
      : `border: ${borderThickness} solid ${borderColor};`;

    // ⚠️ Determine avatar border (based on flaggedAvatars)
    let avatarBorderColor = "transparent"; // Default no border
    if (flaggedAvatars?.length > 0) {
      const hasBanOnSight = flaggedAvatars.some(avatar => avatar.banOnSight === "true");
      avatarBorderColor = hasBanOnSight ? "red" : "yellow"; // Priority: Red > Yellow
    }

    // Create user div
    const userDiv = document.createElement("div");
    userDiv.className = `user ${user?.isFriend ? "friend" : ""}`;
    userDiv.style = borderStyle; // Apply outer border style

    // Highlight the previously selected user
    if (selectedUser?.user?.id === user.id) {
      userDiv.classList.add("selected");
    }

    // Age status
    const ageVerificationMark = user?.ageVerificationStatus === "18+" ? "🔞" : "";

    // Create avatar image with flagged border
    const avatarImg = document.createElement("img");
    avatarImg.src = thumbnail;
    avatarImg.alt = displayName;
    avatarImg.className = "avatar";
    avatarImg.style.border = `5px solid ${avatarBorderColor}`; // Apply flagged avatar border

    // Create user info div
    const userInfoDiv = document.createElement("div");
    userInfoDiv.className = "user-info";
    userInfoDiv.innerHTML = `
      <div class="name-row">
        <span class="name" style="color: ${trustColor}">${displayName}</span>
        ${platform ? `<span class="platform">${platform}</span>` : ""}
        ${user?.ageVerificationStatus === "18+" ? `<span class="age-badge">🔞</span>` : ""}
      </div>
      <div class="details-row">
        ${daysSinceJoin !== null ? `<span class="account-age">📅 ${daysSinceJoin}d</span>` : ""}
        <span class="instance-time">🕒 ${timeInInstance}</span>
      </div>
    `;

    // Append elements to user div
    userDiv.appendChild(avatarImg);
    userDiv.appendChild(userInfoDiv);

    // Add click event to select user
    userDiv.addEventListener("click", () => {
      selectedUser = { user, flaggedGroups, flaggedAvatars, avatars }; // Update selected user
      updateUserInfo(); // Call updateUserInfo when a user is clicked

      // Remove "selected" class from all user divs
      document.querySelectorAll(".user").forEach(div => div.classList.remove("selected"));
      userDiv.classList.add("selected"); // Highlight the clicked user
    });

    // Append user div to list
    userList.appendChild(userDiv);
  });
};


/**
 * Determines the trust level color of a user based on their tags.
 */
const getUserTrustLevel = (user) => {
  let trustColor = trustColors.untrusted;
  const tags = user?.tags || [];

  if (tags.includes("admin_moderator")) {
    trustColor = trustColors.vip;
  } else if (tags.includes("system_troll") || tags.includes("system_probable_troll")) {
    trustColor = trustColors.troll;
  } else if (tags.includes("system_trust_veteran")) {
    trustColor = trustColors.veteran;
  } else if (tags.includes("system_trust_trusted")) {
    trustColor = trustColors.trusted;
  } else if (tags.includes("system_trust_known")) {
    trustColor = trustColors.known;
  } else if (tags.includes("system_trust_basic")) {
    trustColor = trustColors.basic;
  }

  return {
    trustColor
  };
};



/**
 * Updates the left panel with selected user details.
 */
const updateUserInfo = () => {
  if (!selectedUser) {
    document.getElementById("user-info").classList.add("hidden");
    return;
  }

  document.getElementById("user-info").classList.remove("hidden");

  // Clear previous flagged avatars, flagged groups, and avatars
  const flaggedAvatarsSection = document.getElementById("flagged-avatars-section");
  const flaggedAvatarsContainer = document.getElementById("flagged-avatars");
  const flaggedGroupsSection = document.getElementById("flagged-groups-section");
  const flaggedGroupsContainer = document.getElementById("flagged-groups");
  const avatarsSection = document.getElementById("avatars-section");
  const avatarsContainer = document.getElementById("avatars");

  flaggedAvatarsContainer.innerHTML = "";
  flaggedGroupsContainer.innerHTML = "";
  avatarsContainer.innerHTML = "";

  flaggedAvatarsSection.classList.add("hidden");
  flaggedGroupsSection.classList.add("hidden");
  avatarsSection.classList.add("hidden");

  // Update the user's avatar, name, and other info (kept unchanged)
  document.querySelector("#user-info .avatar").src = selectedUser.user?.profilePicOverride ||
    selectedUser.user?.currentAvatarImageUrl ||
    "robot.jpg";
  document.getElementById("info-name").textContent = selectedUser.user?.displayName || "Unknown User";
  document.getElementById("info-name").style.color = getUserTrustLevel(selectedUser).trustColor;

  if (selectedUser.user?.date_joined) {
    const dateJoined = new Date(selectedUser.user.date_joined);
    document.getElementById("info-joined").textContent = `${dateJoined.getDate().toString().padStart(2, '0')}.${(dateJoined.getMonth() + 1).toString().padStart(2, '0')}.${dateJoined.getFullYear()}`;
    document.getElementById("info-days").textContent = Math.floor((Date.now() - dateJoined.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    document.getElementById("info-joined").textContent = "N/A";
    document.getElementById("info-days").textContent = "";
  }

  document.getElementById("info-age").textContent = selectedUser.user?.ageVerified ? "✅ Yes" : selectedUser.user?.ageVerified === false ? "❌ No" : "N/A";

  document.getElementById("info-platform").innerHTML = selectedUser.user?.last_platform?.toLowerCase().includes("android") ?
    `<span class="platform-Android">A</span>` :
    `<span class="platform-PC">PC</span>`;

  const statusText = selectedUser.user?.status ? selectedUser.user.status.toLowerCase() : "N/A";
  document.getElementById("info-status").innerHTML = `${statusEmojis[statusText] || "⚪"} ${statusText}`;

  document.getElementById("info-friend").textContent = selectedUser.user?.isFriend ? "✅ Yes" : "❌ No";

  // 🚩 Flagged Avatars (only if there are any)
  if (selectedUser?.flaggedAvatars && selectedUser.flaggedAvatars.length > 0) {
    flaggedAvatarsSection.classList.remove("hidden");
    
    selectedUser.flaggedAvatars.forEach(avatar => {
      const avatarInfo = document.createElement("div");
      avatarInfo.className = "flagged-avatar-info";

      // Create the avatar name element
      const nameElement = document.createElement("span");
      nameElement.textContent = avatar.name;
      
      // Make the name red if banOnSight is "true"
      if (avatar.banOnSight === "true") {
        nameElement.style.color = "red";
      } else {
        nameElement.style.color = "yellow";
      }

      // Create the type element
      const typeElement = document.createElement("span");
      typeElement.textContent = ` ${avatar.type}`;

      // Append elements to the container
      avatarInfo.appendChild(nameElement);
      avatarInfo.appendChild(typeElement);
      flaggedAvatarsContainer.appendChild(avatarInfo);
    });
  }


// ⚠️ Flagged Groups (only if there are any)
if (selectedUser?.flaggedGroups?.length) {
  flaggedGroupsSection.classList.remove("hidden");
  flaggedGroupsContainer.innerHTML = selectedUser.flaggedGroups
    .map(group => {
      let borderColor = "black"; // Default color
      let isStriped = false;

      // Determine border color and priority
      if (group.type === "SPECIAL") {
        borderColor = "#8A2BE2"; // Purple
      } else if (group.banOnSight) {
        borderColor = "red"; // Red (highest priority)
      } else {
        switch (group.type) {
          case "TOXIC":
            borderColor = "#FF8C00"; // Orange
            break;
          case "WATCH":
            borderColor = "#FFD700"; // Yellow
            break;
          case "PARTNER":
            borderColor = "#32CD32"; // Green
            break;
        }
      }

      // Check if striped
      if (group.priority) {
        isStriped = true;
      }

      // Define border style
      const borderThickness = "5px";
      const borderStyle = isStriped
        ? `border: ${borderThickness} dashed ${borderColor};`
        : `border: ${borderThickness} solid ${borderColor};`;

      return `
        <div class="flagged-group" style="${borderStyle}; padding: 10px; margin-bottom: 10px;">
          <strong>Group Name:</strong> ${group.groupName}<br>
          <strong>Type:</strong> ${group.type}<br>
          <strong>Tags:</strong> ${group.tags.length ? group.tags.join(', ') : "None"}
        </div>
      `;
    })
    .join("");
}




  // 🖼️ Avatars (only if the user has any)
  if (selectedUser?.avatars && selectedUser.avatars.length > 0) {
    avatarsContainer.innerHTML = ""; // Clear previous entries
    avatarsSection.classList.remove("hidden");

    selectedUser.avatars.forEach(avatar => {
      const avatarElement = document.createElement("div");
      avatarElement.textContent = avatar; // Display avatar

      // Check if this avatar is flagged
      const flaggedAvatar = selectedUser.flaggedAvatars.find(fa => fa.name === avatar);

      if (flaggedAvatar) {
        if (flaggedAvatar.banOnSight === "true") {
          avatarElement.style.color = "red"; // 🚨 Red for banOnSight avatars
        } else {
          avatarElement.style.color = "yellow"; // ⚠️ Yellow for flagged avatars
          console.log("yellow")
        }
      }

      avatarsContainer.appendChild(avatarElement);
    });
  }


};



// Run updateUserList every 10 seconds
setInterval(updateUserList, 10000)



document.addEventListener('DOMContentLoaded', () => {
  // Get elements after DOM is fully loaded
  const gearIconContainer = document.getElementById('gear-icon-container');
  const configPopup = document.getElementById('config-popup');
  const closeConfigButton = document.getElementById('close-popup-btn');

  // Tabs for navigation
  const avatarsTab = document.getElementById('avatars-tab');
  const groupsTab = document.getElementById('groups-tab');
  const miscTab = document.getElementById('misc-tab');

  // Configuration pages
  const avatarsPage = document.getElementById('avatars-page');
  const groupsPage = document.getElementById('groups-page');
  const miscPage = document.getElementById('misc-page');

  // Form Elements for Avatars Settings
  const avatarUrlInput = document.getElementById('avatar-url');
  const avatarTypeSelect = document.getElementById('avatar-type');
  const avatarBanCheckbox = document.getElementById('avatar-ban');

  // Form Elements for Groups Settings
  const groupUrlInput = document.getElementById('group-url');
  const groupTypeSelect = document.getElementById('group-type');
  const groupBanCheckbox = document.getElementById('group-ban');

  // Open the config popup when the gear icon is clicked
  gearIconContainer.addEventListener('click', () => {
    configPopup.style.display = 'flex';
    loadConfigData(); // Load saved configuration on open
  });

  // Close the config popup when the close button is clicked
  closeConfigButton.addEventListener('click', () => {
    configPopup.style.display = 'none';
  });

  // Switch between tabs and pages
  function showPage(page) {
    avatarsPage.classList.add('hidden');
    groupsPage.classList.add('hidden');
    miscPage.classList.add('hidden');

    avatarsTab.classList.remove('active');
    groupsTab.classList.remove('active');
    miscTab.classList.remove('active');

    page.classList.remove('hidden');
    if (page === avatarsPage) avatarsTab.classList.add('active');
    else if (page === groupsPage) groupsTab.classList.add('active');
    else if (page === miscPage) miscTab.classList.add('active');
  }

  avatarsTab.addEventListener('click', () => showPage(avatarsPage));
  groupsTab.addEventListener('click', () => showPage(groupsPage));
  miscTab.addEventListener('click', () => showPage(miscPage));

  // Show Avatars page by default
  showPage(avatarsPage);

  // Load configuration from the server
  async function loadConfigData() {
    const response = await fetch('/api/getConfig');
    const configData = await response.json();

    const avatarConfig = configData.avatarConfig || {};
    const groupConfig = configData.groupConfig || {};
    const miscConfig = configData.miscConfig || {};

    // Load Avatars config
    avatarUrlInput.value = avatarConfig.url || '';
    avatarTypeSelect.value = avatarConfig.type || 'CRASHER';
    avatarBanCheckbox.checked = avatarConfig.banOnSight || false;

    // Load Groups config
    groupUrlInput.value = groupConfig.url || '';
    groupTypeSelect.value = groupConfig.type || 'SPECIAL';
    groupBanCheckbox.checked = groupConfig.banOnSight || false;
  }

  // Save Avatars config to the server
  async function saveAvatarConfig() {
    const avatarConfig = {
      url: avatarUrlInput.value,
      type: avatarTypeSelect.value,
      banOnSight: avatarBanCheckbox.checked,
    };
    await fetch('/api/saveAvatarConfig', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(avatarConfig),
    });
  }

  // Save Groups config to the server
  async function saveGroupConfig() {
    const groupConfig = {
      url: groupUrlInput.value,
      type: groupTypeSelect.value,
      banOnSight: groupBanCheckbox.checked,
    };
    await fetch('/api/saveGroupConfig', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groupConfig),
    });
  }

  // Event listeners to save configuration automatically
  avatarUrlInput.addEventListener('input', saveAvatarConfig);
  avatarTypeSelect.addEventListener('change', saveAvatarConfig);
  avatarBanCheckbox.addEventListener('change', saveAvatarConfig);

  groupUrlInput.addEventListener('input', saveGroupConfig);
  groupTypeSelect.addEventListener('change', saveGroupConfig);
  groupBanCheckbox.addEventListener('change', saveGroupConfig);
});
