/*
 Bloxorzi lahendaja – laiuti otsing (BFS)

 Kaardi tähised:
   .  tühjus (kukud alla)
   #  tavaline plaat
   o  oranž (habras) plaat – püsti seista EI tohi
   S  algus (plokk seisab püsti)
   G  auk / eesmärk – sinna peab jõudma PÜSTI

 Seis = ploki kaks "kuubikut": [r1, c1, r2, c2]
   - kui (r1,c1) == (r2,c2), siis plokk seisab püsti
   - muidu lamab; hoiame alati (r1,c1) <= (r2,c2)
 Map-i võtmeks teeme seisust teksti "r1,c1,r2,c2",
 sest JS-is ei saa massiive otse võtmena võrrelda.
*/

const SUUNAD = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

function loeKaart(tekst) {
  const read = tekst.replace(/^\n+|\n+$/g, "").split("\n");
  const laius = Math.max(...read.map(r => r.length));
  const kaart = read.map(r => r.padEnd(laius, ".").split(""));
  let algus = null, eesmark = null;
  kaart.forEach((rida, r) => rida.forEach((ch, c) => {
    if (ch === "S") algus = [r, c, r, c];
    if (ch === "G") eesmark = [r, c];
  }));
  return { kaart, algus, eesmark };
}

function vaiksemEnne(a, b) {
  return (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? [a, b] : [b, a];
}

function liigu(seis, suund) {
  const [r1, c1, r2, c2] = seis;
  const [dr, dc] = SUUNAD[suund];
  let a, b;
  if (r1 === r2 && c1 === c2) {                              // püsti -> pikali
    a = [r1 + dr, c1 + dc];
    b = [r1 + 2 * dr, c1 + 2 * dc];
  } else if ((r1 === r2 && dr === 0) || (c1 === c2 && dc === 0)) { // pikkupidi -> püsti
    a = b = (dr + dc > 0) ? [r2 + dr, c2 + dc] : [r1 + dr, c1 + dc];
  } else {                                                   // külgsuunas -> jääb pikali
    a = [r1 + dr, c1 + dc];
    b = [r2 + dr, c2 + dc];
  }
  [a, b] = vaiksemEnne(a, b);
  return [a[0], a[1], b[0], b[1]];
}

function lubatud(kaart, seis) {
  const [r1, c1, r2, c2] = seis;
  for (const [r, c] of [[r1, c1], [r2, c2]]) {
    if (r < 0 || r >= kaart.length || c < 0 || c >= kaart[0].length) return false;
    if (kaart[r][c] === ".") return false;
  }
  if (r1 === r2 && c1 === c2 && kaart[r1][c1] === "o") return false; // habras plaat murdub
  return true;
}

function lahenda(kaart, algus, eesmark) {
  const jarjekord = [algus];
  let pea = 0;                                   // järjekorra algus (kiirem kui shift())
  const kust = new Map([[algus.join(), null]]);  // seis -> {eelmine, käik}
  const sihtVoti = [eesmark[0], eesmark[1], eesmark[0], eesmark[1]].join();

  while (pea < jarjekord.length) {
    const seis = jarjekord[pea++];
    if (seis.join() === sihtVoti) {
      const kaigud = [];
      let voti = sihtVoti;
      while (kust.get(voti) !== null) {
        const { eelmine, kaik } = kust.get(voti);
        kaigud.push(kaik);
        voti = eelmine;
      }
      return { tee: kaigud.reverse(), uuritud: kust.size };
    }
    for (const k of "UDLR") {
      const uus = liigu(seis, k);
      if (!kust.has(uus.join()) && lubatud(kaart, uus)) {
        kust.set(uus.join(), { eelmine: seis.join(), kaik: k });
        jarjekord.push(uus);
      }
    }
  }
  return { tee: null, uuritud: kust.size };       // lahendust pole
}

const TASE1 = `
###.......
#S####....
#########.
.#########
.....##G##
......###.
`;
const TASE_ORANZ = `
Soo#ooG
`;
const TASE_VOIMATU = `
S#.#G
`;

for (const [nimi, t] of [["Tase 1", TASE1], ["Oranž koridor", TASE_ORANZ], ["Võimatu", TASE_VOIMATU]]) {
  const { kaart, algus, eesmark } = loeKaart(t);
  const { tee, uuritud } = lahenda(kaart, algus, eesmark);
  if (tee === null) console.log(`${nimi}: lahendust pole (uuritud ${uuritud} seisu)`);
  else console.log(`${nimi}: ${tee.length} käiku: ${tee.join("")}  (uuritud ${uuritud} seisu)`);
}