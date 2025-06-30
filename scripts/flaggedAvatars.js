// Importing of the knownAvatars.csv from BanLogger
// Will need a rework after BanLogger goes EOL

const targetAvatarDataCSV = `"AvatarNode Id","Name","Type","Ban On Sight","Link to AvatarNode"
"avtr_610601cc-e6e3-428f-86db-ea5a9ffd6d0d","SSkelly","[CRASHER_PC]",true,"https://vrchat.com/home/avatar/avtr_610601cc-e6e3-428f-86db-ea5a9ffd6d0d"
"avtr_53f28f41-3d57-48a8-bd57-2e0af5b67e49","Tiny Evil 5 PC","[CRASHER_PC]",true,"https://vrchat.com/home/avatar/avtr_53f28f41-3d57-48a8-bd57-2e0af5b67e49"
`;

/**
 * Parses a CSV string into an array of objects.
 * @param {string} csvString - The CSV data as a string.
 * @returns {Array<Object>} - Parsed group data.
 */
function parseCSV(csvString) {
    const rows = csvString.split("\n").map(row => row.split(","))
    if (rows.length < 2) return []

    const headers = rows[0].map(header => header.replace(/"/g, "").trim())
    return rows.slice(1).map(row => {
        return headers.reduce((obj, header, index) => {
            obj[header] = row[index] ? row[index].replace(/"/g, "").trim() : ""
            return obj
        }, {})
    })
}

// Load and parse avatar data
const parsedAvatars = parseCSV(targetAvatarDataCSV);

export function parseAvatars() {
  return parsedAvatars
}