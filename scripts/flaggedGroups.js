// Importing of the knownGroups.csv from BanLogger
// Will need a rework after BanLogger goes EOL

const targetGroupDataCSV = `"Group Id","Type","Priority","Ban On Sight","Message","Tag-Set","Created At","Created By","Last Modified","Last Modified By","Link to Group"
"grp_dc941a74-5ae4-4fba-9004-132eb620f38a","WATCH",false,false,"Gangar is a potential CRASHER group","CRASHER","2024-11-26 10:33","blackwolfwoof","2024-12-26 09:22","blackwolfwoof","https://vrchat.com/home/group/grp_dc941a74-5ae4-4fba-9004-132eb620f38a"
"grp_b825575c-7386-417f-ab68-65736fa83781","TOXIC",true,true,"7c̷o̷u̷n̷c̷i̷l̷ is a BOS CRASHER group","BOS;CRASHER","2024-11-26 16:22","blackwolfwoof","2025-01-11 05:50","blackwolfwoof","https://vrchat.com/home/group/grp_b825575c-7386-417f-ab68-65736fa83781"
"grp_350218b3-04b3-4100-b958-f46c71d4654f","PARTNER",false,false,"Fluffy Snake Mods is a SPECIAL group",,"2024-12-26 09:45","blackwolfwoof","2025-01-19 04:05","blackwolfwoof","https://vrchat.com/home/group/grp_350218b3-04b3-4100-b958-f46c71d4654f"
"grp_6e34dd67-1d31-431a-b13e-658dc44e5c9d","SPECIAL",true,false,"Staff",,"2025-01-29 12:05","blackwolfwoof","",,"https://vrchat.com/home/group/grp_6e34dd67-1d31-431a-b13e-658dc44e5c9d"
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
    const parsedData = rows.slice(1).map(row => {
        return headers.reduce((obj, header, index) => {
            obj[header] = row[index] ? row[index].replace(/"/g, "").trim() : ""
            return obj
        }, {})
    })

    return parsedData
}

const parsedGroupData = parseCSV(targetGroupDataCSV)

/**
 * Parses group data from a CSV string.
 * Uses caching via `parseCSV`.
 * 
 * @param {string} targetGroupDataCSV - The CSV string containing group data.
 * @returns {Array<Object>} - An array of parsed group objects.
 */
export function parseGroups(targetGroupDataCSV) {
    return parsedGroupData
}
