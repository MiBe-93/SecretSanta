# Släktens Secret Santa

En enkel webbsida där släkten kan se vem de ska ge julklapp till. Allt ligger i det här repot och
visas via GitHub Pages. Det finns ingen server, ingen databas, ingen inloggningstjänst och inga
externa tjänster, bara GitHub och webbläsarens inbyggda kryptering.

**Så fungerar det:** Du (admin) lottar en gång på din egen dator. Verktyget skapar en krypterad
"lapp" per person och en 4-siffrig kod per person. Lapparna läggs i repot, och koderna skickar du
ut själv. När en person väljer sitt namn och skriver sin kod på sidan, öppnas lappen i personens
egen webbläsare. Lottningen i klartext finns aldrig i repot, i loggar eller på någon server.

> Läs avsnittet [Begränsningar](#begränsningar-läs-detta) innan du kör på riktigt.

**Ordningen i korthet:** 1) testa lokalt → 2) slå på GitHub Pages → 3) provrunda på riktiga telefoner → 4) checklista → 5) riktig lottning → 6) lägg in filerna → 7) skicka ut koderna.

---

## 1. Testa lokalt (valfritt men rekommenderas)

Du behöver Python 3 (finns på Mac och de flesta Linux-datorer; på Windows kan du installera det från python.org).

```bash
cd docs
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000/` (deltagarsidan) och `http://localhost:8000/admin/` (admin) i webbläsaren.
Avsluta med Ctrl+C i terminalen.

Admin-sidan måste öppnas via `localhost` eller `https://`. Dubbelklicka inte på filen
(`file://` fungerar inte, webbläsaren stänger då av krypteringen).

Knappen **Fyll med testnamn** fyller i påhittade namn, så du kan se hela flödet utan riktiga uppgifter.

## 2. Slå på GitHub Pages

1. Se till att koden ligger på grenen `main` (slå ihop pull requesten på GitHub).
2. Gå till repot på GitHub → **Settings → Pages**.
3. Under *Build and deployment*: **Source = Deploy from a branch**, **Branch = `main`**, mapp **`/docs`** → **Save**.
4. Efter någon minut visas adressen högst upp på sidan, ungefär `https://ANVÄNDARNAMN.github.io/REPONAMN/`.
   Den adressen skriver du in i admin-verktyget.

## 3. Provrunda på riktiga telefoner innan den riktiga lottningen

Gör det här **före** den riktiga lottningen, med påhittade namn, så du vet att allt fungerar på släktens telefoner.

**Varför inte `localhost`?** Din mobil kan inte nå `localhost` på din dator. Dessutom kräver webbläsaren `https://` för krypteringen. Därför måste sidan vara publicerad på GitHub Pages, som har `https` automatiskt.

1. Se till att Pages är påslaget (avsnitt 2) och att sidan syns på sin adress (den ska säga "Lottningen är inte gjord än").
2. Kör admin lokalt (avsnitt 1) på `http://localhost:8000/admin/`. Skriv in **3–4 påhittade namn** (t.ex. Anna Test, Bo Test, Cia Test) och **Pages-adressen** från avsnitt 2. Tryck **Lotta**.
3. Ladda ner ZIP-filen, packa upp den och lägg innehållet i `docs/data/` (se avsnitt 6). Committa och pusha.
4. Vänta några minuter tills Pages uppdaterats.
5. Öppna sidan på en **iPhone (Safari)** och en **Android (Chrome)**. Välj ett av testnamnen, skriv koden från `utskick.txt` och kontrollera att en person visas, att den inte är den du valde, och att en fel kod ger "Fel kod". Prova även att koden tar ca 1 sekund att kontrollera och inte känns för långsam (annars: sänk `iterations` i `docs/config.js`).
6. **Rensa testdatan:**
   ```bash
   npm run rensa-data
   ```
   Skriptet listar filerna och ber dig skriva `ja` innan något tas bort. Det kräver [Node.js](https://nodejs.org) (version 20 eller nyare) på din dator. Har du inte Node kan du istället öppna `docs/data` på GitHub och ta bort filerna där, men lämna `.gitkeep`.
7. Committa och pusha rensningen och **vänta tills Pages uppdaterats**. Kontrollera att sidan åter visar "Lottningen är inte gjord än".
8. Radera testens `utskick.txt` och ZIP-fil på din dator.

## 4. Före den riktiga lottningen

- [ ] Alla namn är rätt stavade (för- och efternamn, ett per rad), inklusive de som tillkommit
- [ ] Alla undantag är inlagda (t.ex. par)
- [ ] Pages-adressen är rätt och slutar med `/` (testa den i en webbläsare)
- [ ] Provrundan (avsnitt 3) är gjord på både iPhone och Android
- [ ] Testdatan är rensad: sidan visar "Lottningen är inte gjord än"

## 5. Lotta på riktigt

1. Kör admin lokalt: `http://localhost:8000/admin/`.
2. Klistra in namnen. Radnummer och `;` i slutet gör inget. Dubbletter varnas för, och två personer med samma namn måste skiljas åt (t.ex. med ett mellannamn).
3. **Undantag:** välj två personer och tryck *Lägg till undantag*. Det gäller åt båda håll.
4. **Inga ömsesidiga byten** är på som standard. Går det inte med regeln får du en tydlig varning och lottningen görs utan den. Går det inte alls får du ett felmeddelande som säger vilka regler som krockar.
5. Skriv in sidans **publika adress**.
6. Tryck **Lotta**. Du ser bara "Lottning klar, X filer skapade". Verktyget visar aldrig vem som fick vem, och du ska inte försöka ta reda på det.
7. Ladda ner de två filerna:
   - **ZIP med `data/`**: krypterade filer som ska in i repot.
   - **`utskick.txt`**: ett färdigt meddelande per person, med personens kod.

## 6. Lägg in filerna i repot

Packa upp ZIP-filen. Du får en mapp `data`. Innehållet ska ligga i `docs/data/`.

**Via GitHub-webben:** gå till mappen `docs/data` i repot → **Add file → Upload files** → dra in filerna från den uppackade `data`-mappen → **Commit changes**.

**Via git:**
```bash
# packa upp ZIP-filen så att filerna hamnar i docs/data/
git add docs/data
git commit -m "Ny lottning"
git push
```

Vänta några minuter, och prova sedan själv med din egen kod (men titta inte på någon annans).

ZIP-filen innehåller bara krypterade filer, och du kan radera den när filerna är inlagda.

## 7. Skicka ut koderna och spara `utskick.txt`

Öppna `utskick.txt`, kopiera varje persons meddelande och skicka det privat till just den personen (SMS, Messenger, vad som helst).

**Om `utskick.txt`:**
- Den ligger **bara på din dator**. Den får **aldrig checkas in i repot** (den är utpekad i `.gitignore`) och får inte skickas i klartext till fler än den enskilde personen.
- Radera den **inte** direkt efter utskicket. Du behöver den om någon glömmer sin kod: då skickar du om just den personens meddelande. Ingen ny lottning behövs.
- Radera den efter jul, eller när alla bekräftat att de öppnat sin lapp.

## 8. Ny lottning och cache

Om någon hoppar av, någon tillkommer eller något har gått fel, gör du en **ny lottning**. Den ger nya slumpade filer och **nya koder till alla**, så de gamla koderna slutar fungera.

GitHub Pages kan servera gamla filer i upp till ca 10 minuter efter en ändring. Sidan försöker hämta färska filer, men helt undvika det går inte. Gör i den här ordningen:

1. `npm run rensa-data` (tar bort de gamla lapparna, annars ligger de kvar publikt).
2. Kör admin igen (avsnitt 5) och lägg in de nya filerna i `docs/data/` (avsnitt 6).
3. Committa och pusha.
4. **Vänta** några minuter, och testa själv att din nya kod fungerar.
5. **Först därefter** skickar du ut de nya koderna till **alla** (och sparar den nya `utskick.txt`; ersätt den gamla).

Om någon öppnar sidan medan filerna är mellan två versioner visas "Det verkar ha gjorts en ny lottning. Vänta några minuter och ladda om sidan." istället för "Fel kod". Det löser sig av sig själv.

---

## Inställningar

`docs/config.js` har sidans rubrik, namnet som visas vid "Glömt koden? Fråga …" och antalet iterationer i nyckelhärledningen.
Ändringar där kräver att du committar filen. Ändrade iterationer gäller bara nya lottningar.

## Tekniska detaljer

- `docs/lib/draw.js`: lottning. Slumpad backtracking med kryptografisk slump (`crypto.getRandomValues`). Hittar en lösning om det finns en, och ger annars ett felmeddelande om vilka regler som krockar.
- `docs/lib/crypto.js`: PBKDF2-HMAC-SHA256 (nyckel av `id:PIN` + slumpad salt, 1 000 000 iterationer), AES-256-GCM med slumpad IV och personens id som AAD. Namnet paddas till exakt 64 byte så att alla filer är lika stora. Fel PIN och trasig fil ger samma svar: "Fel kod".
- `docs/lib/lookup.js`: hämtar listan och lappen (`cache: 'no-store'` plus en enkel cache-buster) och skiljer "fel kod" från "ny lottning" (404) och nätfel.
- Id:n och filnamn är slumpade och inte härledda från namn.
- Samma `lib/`-kod körs i Node (tester), admin-verktyget och deltagarsidan.
- Sidorna har strikt Content-Security-Policy (`default-src 'self'`), `no-referrer` och `noindex`. Inget laddas från andra adresser, och inget sparas i webbläsaren (ingen localStorage, inga cookies).

### Köra testerna

```bash
npm test
```

Kräver Node 20 eller nyare, inga installationer. Testerna använder bara påhittade namn.

---

## Begränsningar (läs detta)

1. **En 4-siffrig PIN går att knäcka av någon som aktivt försöker.** Lapparna ligger publikt och det finns ingen server som kan spärra felförsök. Det finns bara 10 000 möjliga koder. Den långsamma nyckelhärledningen gör varje gissning dyrare, men den som vill kan prova alla koder för en lapp på kort tid. Väntetiden på sidan (2 s, 4 s, 8 s …) är bara en **gardin på klientsidan** och inget riktigt skydd: den försvinner om man laddar om sidan eller bygger ett eget program. Det är rimligt skydd mot nyfikna släktingar, inte mot någon som vill hacka sig in.
2. **Du som kör lottningen känner alla koder** (de står i `utskick.txt`) och kan i teorin öppna alla lappar. Titta inte. Verktyget visar inte resultatet, men tekniskt går det. Eftersom du sparar `utskick.txt` en tid ligger koderna kvar på din dator, så skydda den datorn.
3. **Namnlistan (`participants.json`) och sidan är publika.** Den som hittar adressen ser namnen i listan (men inte vem som drog vem). GitHub Pages kan kräva ett publikt repo beroende på kontotyp, och då är all kod och alla krypterade lappar också publika.
4. **Filen `Actors` finns kvar i historiken.** Den lades in i repot i början (14 för- och efternamn, inga andra uppgifter som mejl, telefon eller koder) och togs sedan bort, men den finns kvar i git-historiken. Historiken har granskats: den innehåller inga andra personuppgifter, så den har lämnats som den är. Är repot publikt kan alla se de namnen i historiken. Vill du ändå ta bort dem behövs en omskrivning av historiken, vilket du i så fall bestämmer själv.
5. **Det går inte att se vilka som har öppnat sin lapp.** En glömd kod löses genom att du skickar om den från din sparade `utskick.txt`. Har du raderat den återstår bara en ny lottning.
6. Lottningen är slumpad men inte exakt jämnt fördelad över alla tänkbara lottningar när det finns många undantag. Det har ingen praktisk betydelse här.
