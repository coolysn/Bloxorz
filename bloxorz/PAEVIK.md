# Bloxorz – lahendaja ja graafiline mäng

## Failid
| Fail | Mis see on | Kuidas käivitada |
|---|---|---|
| `bloxorz_solver.js` | Omaloodud lahendaja (BFS) | `node bloxorz_solver.js` |
| `engine.js` | AI-ga tehtud mootor: reeglid (oranžid plaadid, lülitid, sillad, poolitus) + BFS. Ei sisalda graafikat | kasutavad `index.html` ja `test.js` |
| `test.js` | Mootori test kõigi näidistasemetega | `node test.js` |
| `index.html` | Lehe struktuur | Ava brauseris (topeltklõps) |
| `style.css` | Välimus | – |
| `game.js` |AI-ga tehtud graafika ja kasutajaliides: joonistamine, animatsioon, nupud, redaktor | – |

---

## 1. Minu algoritm ja andmestruktuurid

### Ülesanne
Antud on laud. Leia lühim käikude jada, mis viib ploki **püsti** auku `G`, või teata, et seda pole.

### Põhiidee: mäng on graaf
- **Tipp** = ploki asend laual (seis)
- **Serv** = üks käik (↑ ↓ ← →)
- Igast seisust on **kuni 4 naabrit**
- Lahenduse otsimine = **lühima tee otsimine graafis** → **laiuti otsing (BFS)**

### Miks just BFS?
- BFS vaatab läbi kõigepealt kõik seisud, kuhu jõuab **1 käiguga**, siis **2 käiguga** jne
- Seega esimene kord, kui jõuame sihini, on tee **garanteeritult lühim**
- Kui järjekord saab tühjaks ja siht jäi leidmata, siis **lahendust pole**. See on tõestus, mitte oletus: kõik kättesaadavad seisud on läbi vaadatud.
- Iga käigu "hind" on sama (1), seega pole vaja keerulisemat algoritmi (Dijkstra, A*)

### Kaardi kirjapanek
```
.  tühjus (kukud alla)
#  tavaline plaat
o  oranž plaat – püsti seista ei tohi
S  algus
G  auk
```
Näide (originaalmängu tase 1):
```
###.......
#S####....
#########.
.#########
.....##G##
......###.
```

### Andmestruktuurid
| Struktuur | JS-is | Milleks |
|---|---|---|
| **Kaart** | 2D massiiv `kaart[rida][veerg]` | Kiire kontroll: mis plaat selles ruudus on |
| **Seis** | massiiv `[r1, c1, r2, c2]` | Ploki kahe poole koordinaadid |
| **Järjekord** | massiiv + indeks `pea` | BFS-i ootejärjekord: uued lõppu, töödeldav eest |
| **`kust`** | `Map` (võti → `{eelmine, kaik}`) | 1) külastatud seisud, 2) tee taastamine |

**Seisu kokkulepe:**
- `(r1,c1) == (r2,c2)` → plokk **seisab püsti** (1 ruut)
- muidu **lamab** (2 ruutu)
- Väiksem koordinaat alati ette, et sama asend ei oleks kahel kujul (`[0,1,0,2]` ja `[0,2,0,1]` oleks muidu "kaks erinevat" seisu)

**Miks järjekord on massiiv + `pea`, mitte `shift()`?**
`shift()` nihutab iga kord kogu massiivi (aeglane). Indeksiga loeme lihtsalt järgmise elemendi.

**Miks võti on tekst (`seis.join()`)?**
JS-is on `[1,2]` ja `[1,2]` kaks *erinevat* objekti, seega `Map` ei leiaks neid üles. Tekst `"1,2"` on alati sama.

### Funktsioonid
| Funktsioon | Mida teeb |
|---|---|
| `loeKaart(tekst)` | Teeb tekstist 2D massiivi, leiab `S` ja `G` |
| `liigu(seis, suund)` | Arvutab uue seisu pärast ühte käiku |
| `lubatud(kaart, seis)` | Kas uus seis on laual ja ohutu? |
| `lahenda(kaart, algus, eesmark)` | BFS, tagastab tee või `null` |

### `liigu()` – kolm juhtu
```
1) PÜSTI → PIKALI            ■  →  ■■    uued ruudud 1 ja 2 sammu kaugusel
2) PIKALI, veereb pikkupidi  ■■ →  ■     plokk tõuseb püsti otsa taha
3) PIKALI, veereb külgsuunas ■■ →  ■■    mõlemad pooled nihkuvad 1 võrra
```
Pikkupidi või külgsuunas? Kui plokk lamab **reas** (`r1 == r2`) ja liigub **vasakule/paremale** (`dr == 0`), on see pikkupidi. Sama kehtib veeru ja üles/alla liikumise kohta.

### `lubatud()` – kolm kontrolli
1. Mõlemad pooled on laua piires
2. Kumbki pool ei ole tühjusel `.`
3. Kui plokk seisab püsti, ei tohi see olla oranžil `o`

### Arvutusdemo samm-sammult
Väike kaart: `S##G` (algus veerus 0, auk veerus 3)

| Samm | Võtan järjekorrast | Käik | Uus seis | Tulemus |
|---|---|---|---|---|
| 1 | `0,0,0,0` (püsti) | U, D, L | – | keelatud (laualt väljas) |
| | | R | `0,1,0,2` (pikali) | **lisan** |
| 2 | `0,1,0,2` | U, D | – | keelatud |
| | | L | `0,0,0,0` | juba nähtud |
| | | R | `0,3,0,3` (püsti) | **lisan** |
| 3 | `0,3,0,3` | – | – | **SIHT!** |

**Tee taastamine:** `kust` ütleb, et `0,3,0,3` tuli seisust `0,1,0,2` käiguga `R`, see omakorda seisust `0,0,0,0` käiguga `R`. Tagurpidi lugedes: **`RR`**, 2 käiku.

### Tulemused terminalis
```
$ node bloxorz_solver.js
Tase 1: 7 käiku: RDDRRDR  (uuritud 78 seisu)
Oranž koridor: 4 käiku: RRRR  (uuritud 5 seisu)
Võimatu: lahendust pole (uuritud 1 seisu)
```
- **Tase 1**: 7 käiku, sama mis mängu teadaolev parim lahendus
- **Oranž koridor** (`Soo#ooG`): plokk ületab oranžid plaadid ainult pikali
- **Võimatu** (`S#.#G`): mõlemas suunas on tühjus. Algoritm tõestab, et lahendust pole.

### Kui palju seise on?
Iga ruudu kohta kuni 3 asendit (püsti, pikali rea suunas, pikali veeru suunas). 10×6 laual on seega **alla 200 seisu** ja otsing kestab alla millisekundi.

---

## 2. Muljed ja keerdkäigud (2 tundi)

### Päevik (märksõnad)
| Aeg | Mida tegin | Kus jäin toppama | Kuidas edasi sain |
|---|---|---|---|
| 0:00 | Bloxorzi mängimine, tasemed 1–… | *(oma muljed)* | |
| 0:15 | Seisu kuju: 4 koordinaati (r1,c1,r2,c2) | Sama seis kahel kujul | Järjestan koordinaadid (väiksem ette) |
| 0:30 | `liigu()` – 3 liikumisjuhtu | Tingimuste järjekord (`&&` / `\|\|`) | Lisasin sulud |
| 0:45 | BFS + tee taastamine `kust`-Map-ist | Massiiv ei sobi Map-i võtmeks; testtase oli kogemata lahendamatu | Seis tekstiks `seis.join()`; kujundasin taseme ümber – lahendaja oli õige |
| 1:00 | AI-ga mootor: lülitid, sillad | Sild vales grupis, raske lüliti ei avanud midagi | Grupinumbrid üle kontrollitud |
| 1:20 | Poolitus kaheks kuubikuks | Kuubikute järjekord seisu võtmes | Sorteerimine võtmes |
| 1:40 | Isomeetriline joonistamine, animatsioon, redaktor | Kõik oli ühes 500-realises HTML-failis | Jagasin: `index.html`, `style.css`, `engine.js`, `game.js` |

### Muljed
- Mäng tundub lihtne, aga juba 3. tasemel tuleb mitu käiku ette mõelda. *(täienda omaga)*
- Kõige raskem oli aru saada, **mis on "seis"**. Kui see oli paigas, oli BFS ise lühike.
- "Lahendust pole" on ka vastus. Esimesel korral arvasin, et algoritm on vigane, aga tegelikult oli tase lahendamatu.
- Huvitav tähelepanek: minu lahendaja uuris tasemel 1 **78** seisu, AI mootor **65**. Põhjus: mina kontrollin sihti alles siis, kui seisu järjekorrast **võtan**. Mootor kontrollib siis, kui seisu **leiab**, ja lõpetab varem. Vastus (7 käiku) on mõlemal sama.

---

## 3. Tehisintellekti loodud kood

### Kasutatud viibad ja tulemused
| # | Viip | Tulemus |
|---|---|---|
| 1 | *"Otsi veebist Bloxorzi reeglid: oranžid plaadid, lülitid, sillad, poolitus."* | Kokkuvõte reeglitest: O-lüliti käivitub alati, X-lüliti ainult püsti; poolituslüliti teeb kaks kuubikut |
| 2 | *"Laienda minu BFS-lahendajat nii, et see toetaks lüliteid ja sildu. Silla olek peab olema seisu osa."* | Seisule lisandus `mask` (bitimask). Esimene versioon andis raske lüliti tasemel "lahendust pole", sest sild oli vales grupis. Parandasin taseme. |
| 3 | *"Lisa poolitus: plokk jaguneb kaheks kuubikuks, mida liigutatakse eraldi ja mis kõrvuti liituvad."* | Uus seisu kuju `{a, b, split, mask}`, BFS proovib nüüd 8 käiku (4 kummalegi kuubikule). Poolitustase: 20 käiku, 474 seisu |
| 4 | *"Tee graafiline mäng, kus saab laua seisu ise ette anda, ja näita animatsiooniga, kuidas lõppu jõuda. Isomeetriline vaade, värviline."* | `<canvas>`-põhine mäng, tasemeredaktor, "Näita teed" nupp, vikerkaarejälg |
| 5 | *"Kas mängu saab ka teha JavaScriptiga?"* | Selgus, et mäng ongi JS-is. Sain mootori ka eraldi failina (`engine.js`) |
| 6 | *"Mis point on teha eraldi engine.js, ja kas HTML-i koodi saaks natuke lihtsustada?"* | Varem oli kood dubleeritud. Nüüd laeb HTML `engine.js`-i; kood on jagatud 4 faili ja kommenteeritud |
| 7 | *"Kirjuta test, mis lahendab kõik näidistasemed terminalis."* | `test.js`, väljund allpool |

```
$ node test.js
Tase 1 (originaal)   7 käiku  RDDRRDR  (65 seisu)
Habras koridor       8 käiku  RRRRRRRR  (33 seisu)
Pehme lüliti         13 käiku  RRRRRURDLULDR  (36 seisu)
Raske lüliti         13 käiku  RULDLURDRRRRR  (48 seisu)
Poolitus             20 käiku  RRRRRRRRRDDRR²R²R²R²R²R²R²R  (474 seisu)
Lukus tee            Lahendust pole – kõik kättesaadavad seisud on läbi vaadatud.  (31 seisu)
```
(`²` = käik tehakse teise kuubikuga)

### Koodi struktuur
```
index.html   lehe ülesehitus, laeb sisse kaks skripti
style.css    välimus
engine.js    MOOTOR: reeglid + BFS        ← ei tea graafikast midagi
game.js      MÄNG: joonistamine, animatsioon, nupud, redaktor
test.js      kasutab engine.js-i ilma brauserita
```
Põhimõte: **mootor otsustab, mis on lubatud; game.js ainult näitab**. Sama `step()` funktsiooni kasutavad BFS, klaviatuuriga mängimine ja animatsioon, nii et reeglid on kirjas ainult ühes kohas.

### Nutikamad kohad
1. **Lülitid bitimaskina.** Iga silla grupp on üks bitt: `mask ^= 1 << grupp`. Sama asukoht, aga erinevad sillad on BFS-i jaoks *erinev seis*. Ilma selleta ei leiaks otsing teed, mis nõuab lülitile tagasi minemist.
2. **Kuubikute sorteerimine võtmes.** "Kuubik A siin, B seal" == "B siin, A seal". Sorteerimine vähendab otsinguruumi umbes poole võrra.
3. **Tee taastamine.** Nagu minu versioonis: iga seisu juures on kirjas, kust ja mis käiguga sinna jõuti.
4. **Isomeetriline projektsioon.** `x = (veerg − rida) · laius/2`, `y = (veerg + rida) · laius/4 − z`. Ruudud joonistatakse **tagant ettepoole**, et eesmised kataksid tagumisi.
5. **Animatsioon.** Ploki "kasti" nurgad liiguvad sujuvalt vana ja uue asendi vahel (`ease`), keskel on väike hüpe (`sin`).
6. **Redaktor teab ainult tähti.** Klõps paneb tekstikaardile ühe tähe ja laud loetakse uuesti `parseLevel()`-iga. Redaktor ei pea reegleid teadma.

---

## 4. Uhke värviline demo (stsenaarium)
1. Ava `index.html`, vali **"Tase 1 (originaal)"** → **Lahenda** → "Lühim tee: 7 käiku"
2. **▶ Näita teed**: plokk veereb, laual jääb vikerkaarejälg, lõpus vajub auku
3. Vali **"Poolitus"** → **▶ Näita teed**: plokk poolitub, kuubikud vajutavad lüliteid, sillad avanevad, kuubikud liituvad
4. Vali **"Lukus tee"** → **Lahenda** → "Lahendust pole" (punane)
5. **Redaktoris** joonista kiirelt oma laud (plaat, oranž, algus, auk) → **Lahenda** → **Näita teed**
6. Proovi ise nooltega ja kukkuda servast alla → "Plokk kukkus servast alla"
