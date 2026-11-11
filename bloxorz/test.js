// Mootori test ilma brauserita:  node test.js
const { parseLevel, solve, PRESETS } = require("./engine.js");
 
for (const [name, text] of Object.entries(PRESETS)) {
  const r = solve(parseLevel(text));
  const moves = r.path ? r.path.map(([d, w]) => d + (w ? "²" : "")).join("") : "";
  console.log(name.padEnd(20), r.path ? `${r.path.length} käiku  ${moves}` : r.reason,
              ` (${r.explored} seisu)`);
}