# Log Lupus 🐺
> ‼️ **EARLY ACCESS**  
> This software is in no means finished. Bugs will happen! If you find one, please let me know.<br>

### Table of content:
1. [Installation](#installation)
2. [Configuring](#configuration)
3. [Troubleshooting](#troubleshooting)


## Installation
> ℹ️ **Disclaimer**  
> As there is no binary/exe you can simply execute, you will have to configure the code step by step and use NodeJS. I might change this in teh future to make it more user friendly to beginners.<br>

[Download NodeJS](https://nodejs.org/en/download) and install it on your operating system.<br>
If you are on Windows, look for `Windows Installer (.msi)` or use winget via `winget install OpenJS.NodeJS.LTS`.<br>

Unpack the zip of the soucre code, and open your command promt in there. You can do so, by typing `cmd` in the folder path in your explorer window.

Run `npm i` to install all necesary NPM packages on your system.
<details>
<summary>📦 Node.js Dependencies</summary>

| Package Name        | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| @logdna/tail-file   | Monitors VRChat logfile|
| better-sqlite3      | Database (currently not in use) |
| dotenv              | Loads environment variables from a `.env` file into `process.env`. |
| express             | Minimal and flexible Node.js web application framework. |
| js-string-cleaner   | Utility to clean and normalize strings for usernames. |
| node-cache          | In-memory caching module for Node.js. |
| otplib              | One-time password (OTP) library for 2FA using TOTP and HOTP. |
| quick.db            | A simple SQLite-based key-value store wrapper for beginners. |
| remove-accents      | Removes diacritical marks from strings (e.g., accents). |
| say                 | Text-to-speech module for speaking text aloud. |
| sound-play          | Lightweight audio playback module for playing sounds in Node.js. |
| ws                  | A fast, simple, and efficient WebSocket library for Node.js. |

</details>

## Configuration
> ℹ️ **Disclaimer**  
> Your login data is very sensetive. No data is shared to the developer or any other third party other than VRChat itself for logging in.
The login is necesary, to get data about the users who join your instance like the avatar and groups they use/are in.<br>
### `.env` File
  You have to configure the following variables:
  - `GROUP_ID`: The group id of the VRChat group that automatic moderation actions like bans should be applied to.
  - `VRCHAT_USERNAME`: Your VRChat username. Email works too alternatively. Especially when it comes to special characters.
  - `VRCHAT_PASSWORD`: Your VRChat password. You can use \` or \' to escape special chaarcters as shown by the `"password"` example which asumes the password to be `password`.
  - `TOTP_SEED`: Your 2FA seed which is used to generate your TOTP (Time-Based One-Time Password) for login.
### Avatars
  Avatars are currently imported via a CSV format into [flaggedAvatars.js](./scripts/flaggedAvatars.js). There you can add your own collection of avatars.
### Groups
  Groups are currently imported via a CSV format into [flaggedGroups.js](./scripts/flaggedGroups.js). There you can add your own collection of avatars.
  | Type | What it does | Sound / Text to speech | Color
| ------------- | ------------- | ------- | ----- |
| WATCH | Used to indicate a problematic group | ✅ | **Yellow**
| TOXIC | Used to indicate a problematic group (more serious) | ✅ | **Orange**
| PARTNER | Used to indicate memebrs of groups | ❌ | **Green**
| SPECIAL | Used for staff members | ❌ | **Purple**
| Ban on sight (Bool) | Ban the person as soon as they are in the same instance | ✅ | **Red**
| Priority (Bool) | Used to hoist groups that should be announced fist via TTS | | **Black Stripes**
### Powershell
#### Execution policy
You will have to set the execution policy if you never changed it before, that way the script can run the command to start the NodeJS applciation.  
Open powershell and run `Set-ExecutionPolicy Unrestricted -Scope CurrentUser` to set it.  

#### "Double-Click" to run
To be able to "double-click" run the powershell, rightclick the .ps1 powershell file > Open With > Chose another App, then scroll down and click "Choose an app on your PC". In the path at the top, paste `%SystemRoot%\System32\WindowsPowerShell\v1.0`, hit Enter and select `powershell.exe`.
As an optional goodie, you can create a shortcut to the .ps1 file and put that into your VRCX auto start folder, that way it starts when you run VRChat.

## Troubleshooting
Check your `.env` file and set `LOGLEVEL` to `DEBUG`.<br>
You can contact me via email `wolf@blackwolfwoof.com`, Discord (@blackwolfwoof) or my [Discord Server](https://discord.gg/8EZMyyw).

### Powershell Issues
Make sure you have [Powershell](#powershell) setup. If you still have issues, use `Bypass` instead of `Unrestricted`.
