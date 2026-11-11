// Mootori test ilma brauserita:  node test.js
// Lahendab kõik näidistasemed ja prindib käikude arvu, käigud ja uuritud seisude arvu.
// Kasulik pärast muudatusi engine.js-is: kui tulemused muutuvad, on midagi katki.
const { parseLevel, solve, PRESETS } = require("./engine.js");   // impordi mootori funktsioonid

for (const [name, text] of Object.entries(PRESETS)) {
  const r = solve(parseLevel(text));                               // tekst -> laud -> BFS
  // käigud tekstiks; ² tähendab, et käik tehti teise kuubikuga (poolitus)
  const moves = r.path ? r.path.map(([d, w]) => d + (w ? "²" : "")).join("") : "";
  console.log(name.padEnd(20), r.path ? `${r.path.length} käiku  ${moves}` : r.reason,
              ` (${r.explored} seisu)`);
}
