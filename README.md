# Släktens Secret Santa

En enkel webbsida där släkten kan se vem de ska ge julklapp till. Allt ligger i det här repot och
visas via GitHub Pages. Det finns ingen server, ingen databas, ingen inloggningstjänst och inga
externa tjänster, bara GitHub och webbläsarens inbyggda kryptering.

**Så fungerar det:** Du (admin) lottar en gång på din egen dator. Verktyget skapar en krypterad
"lapp" per person. Lapparna läggs i repot. När en person skriver sitt för- och efternamn på sidan
öppnas just den personens lapp, i personens egen webbläsare. Det finns inga koder och ingen inloggning:
**namnet är nyckeln.** Lottningen i klartext finns aldrig i repot, i loggar eller på någon server.

> Läs avsnittet [Begränsningar](#begränsningar-läs-detta) innan du kör på riktigt. Det viktigaste:
> den som känner till en persons för- och efternamn kan öppna den personens lapp.

**Ordningen i korthet:** 1) testa lokalt → 2) slå på GitHub Pages → 3) provrunda på riktiga telefoner → 4) checklista → 5) riktig lottning → 6) lägg in filerna → 7) skicka ut länken.

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

1. Se till att koden ligger på grenen `main`.
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
5. Öppna sidan på en **iPhone (Safari)** och en **Android (Chrome)**. Skriv ett av testnamnen och kontrollera att en person visas och inte är den du skrev. Prova också ett felstavat namn (ska ge "Vi hittar inte det namnet"). Kontrollera att det tar ca 1 sekund att öppna lappen och inte känns för långsamt (annars: sänk `iterations` i `docs/config.js`).
6. **Rensa testdatan:**
   ```bash
   npm run rensa-data
   ```
   Skriptet listar filerna och ber dig skriva `ja` innan något tas bort. Det kräver [Node.js](https://nodejs.org) (version 20 eller nyare) på din dator. Har du inte Node kan du istället öppna `docs/data` på GitHub och ta bort filerna där, men lämna `.gitkeep`.
7. Committa och pusha rensningen och **vänta tills Pages uppdaterats**. Kontrollera att sidan åter visar "Lottningen är inte gjord än".
8. Radera testens ZIP-fil på din dator.

## 4. Före den riktiga lottningen

- [ ] Alla namn är rätt stavade (för- och efternamn, ett per rad), inklusive de som tillkommit
- [ ] Namnen är skrivna så som släkten skriver dem. Det är det namnet var och en ska skriva på sidan
- [ ] Alla undantag är inlagda (t.ex. par)
- [ ] Pages-adressen är rätt och slutar med `/` (testa den i en webbläsare)
- [ ] Provrundan (avsnitt 3) är gjord på både iPhone och Android
- [ ] Testdatan är rensad: sidan visar "Lottningen är inte gjord än"

## 5. Lotta på riktigt

1. Kör admin lokalt: `http://localhost:8000/admin/`.
2. Klistra in namnen. Radnummer och `;` i slutet gör inget.
   - Det räcker att personen skriver sitt namn ungefär som du skrev det: stor/liten bokstav, extra mellanslag och å/ä/ö spelar ingen roll (`Åsa` och `asa` är samma namn), och `Anna-Lena` och `Anna Lena` är samma namn.
   - Har någon mellannamn kan hen skriva det eller låta bli, **om du bara skrev förnamn och efternamn**. Skriv därför helst bara förnamn och efternamn. Har du skrivit tre namn, "Anna Maria Svensson", måste personen skriva alla tre.
   - Två personer som inte går att skilja åt (t.ex. "Åsa Berg" och "Asa Berg", eller två "Anna Svensson") varnas för. Skilj dem åt med ett mellannamn.
3. **Undantag:** välj två personer och tryck *Lägg till undantag*. Det gäller åt båda håll.
4. **Inga ömsesidiga byten** är på som standard. Går det inte med regeln får du en tydlig varning och lottningen görs utan den. Går det inte alls får du ett felmeddelande som säger vilka regler som krockar.
5. Skriv in sidans **publika adress**.
6. Tryck **Lotta**. Du ser bara "Lottning klar, X filer skapade". Verktyget visar aldrig vem som fick vem, och du ska inte försöka ta reda på det.
7. Ladda ner **ZIP med `data/`** (krypterade filer som ska in i repot) och kopiera **meddelandet till släkten** (samma text till alla).

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

Vänta några minuter, och prova sedan själv med ditt eget namn (men titta inte på någon annans).

ZIP-filen innehåller bara krypterade filer, och du kan radera den när filerna är inlagda.

## 7. Skicka ut länken

Skicka meddelandet från admin-verktyget (adressen och en kort förklaring) till släkten, till exempel i familjechatten. Det är samma text till alla och den innehåller inga hemligheter. Då skriver var och en sitt namn på sidan och får sin person.

Det finns inga koder att hålla reda på, så inget behöver sparas av dig efteråt.

## 8. Ny lottning och cache

Om någon hoppar av, någon tillkommer eller något har gått fel, gör du en **ny lottning**. Den ger ett nytt slumpat salt, helt nya filnamn och en ny lottning, så de gamla lapparna slutar fungera. Ingen behöver få något nytt utskick, men alla ser en ny person om de öppnar sidan igen. Säg därför till i släkten att en ny lottning gjorts, och att ingen ska köpa något förrän hen öppnat sin nya lapp.

GitHub Pages kan servera gamla filer i upp till ca 10 minuter efter en ändring. Sidan försöker hämta färska filer, men helt undvika det går inte. Gör i den här ordningen:

1. `npm run rensa-data` (tar bort de gamla lapparna, annars ligger de kvar publikt).
2. Kör admin igen (avsnitt 5) och lägg in de nya filerna i `docs/data/` (avsnitt 6).
3. Committa och pusha.
4. **Vänta** några minuter, och testa själv med ditt eget namn.
5. **Först därefter** berättar du för släkten att den nya lottningen är klar.

Om någon öppnar sidan medan filerna är mellan två versioner visas "Vi hittar inte det namnet …" med en uppmaning att vänta några minuter och ladda om. Det löser sig av sig själv.

---

## Inställningar

`docs/config.js` har sidans titel, året som visas i rubriken, namnet som visas vid "Hittar du inte dig? Fråga …" och antalet iterationer i nyckelhärledningen.
Ändringar där kräver att du committar filen. Ändrade iterationer gäller bara nya lottningar.

## Utseende

Sidan följer designen "Julen med släkten / hemlig tomte". Texterna står i `docs/index.html`, färger och typsnitt i `docs/style.css`, och bilderna (kuvert, tomte, logga, tomtemössa) är SVG-filer i `docs/img/`. Typsnitten (Inter, Fraunces och Dancing Script, alla under SIL Open Font License) ligger i `docs/fonts/`, så inget hämtas från andra adresser. Admin-sidan har ett enklare utseende i `docs/admin/admin.css`.

## Tekniska detaljer

- `docs/lib/names.js`: gör om ett namn till en nyckel (små bokstäver, utan å/ä/ö-prickar, bindestreck och punkter blir mellanslag). Samma regler används av admin-verktyget och av sidan.
- `docs/lib/draw.js`: lottning. Slumpad backtracking med kryptografisk slump (`crypto.getRandomValues`). Hittar en lösning om det finns en, och ger annars ett felmeddelande om vilka regler som krockar.
- `docs/lib/crypto.js`: filnamnet är de första 8 byten av SHA-256 av `salt + namnnyckel`, och saltet är slumpat per lottning (står i `data/meta.json`). Själva lappen krypteras med PBKDF2-HMAC-SHA256 (nyckel av `id:namnnyckel` + slumpad salt, 1 000 000 iterationer) och AES-256-GCM med slumpad IV och id som AAD. Lappen innehåller både personens eget namn (för hälsningen "Hej Åsa") och mottagarens namn, och paddas till exakt 160 byte så att alla filer är lika stora.
- `docs/lib/lookup.js`: hämtar `meta.json` och lappen (`cache: 'no-store'` plus en enkel cache-buster) och skiljer "hittar inte" från trasig lapp och nätfel. Skriver man mellannamn provas också förnamn + efternamn.
- Det finns ingen deltagarlista i klartext i repot, bara `meta.json` (saltet) och en lapp per person.
- Samma `lib/`-kod körs i Node (tester), admin-verktyget och deltagarsidan.
- Sidorna har strikt Content-Security-Policy (`default-src 'self'`), `no-referrer` och `noindex`. Inget laddas från andra adresser, och inget sparas i webbläsaren (ingen localStorage, inga cookies). Namnet skickas aldrig i adressen. Resultatet göms efter 60 sekunder eller när fliken lämnas.

### Köra testerna

```bash
npm test
```

Kräver Node 20 eller nyare, inga installationer. Testerna använder bara påhittade namn.

---

## Begränsningar (läs detta)

1. **Namnet är nyckeln, så vem som helst som känner till en persons för- och efternamn kan öppna personens lapp.** Det är priset för att slippa koder. Lapparna är krypterade och namnlistan ligger inte i klartext, men släktingar vet ju vad varandra heter. Någon som är nyfiken kan skriva din mammas namn på sidan och se vem hon ska ge till. Och eftersom filerna är publika behövs inte ens sidan: en tekniskt kunnig person kan prova namn mot filerna utan att någon märker det. Det finns ingen server som kan spärra försök. Det är rimligt skydd mot en slump och mot utomstående som inte vet vilka som är med, men inget skydd mot släktingar som aktivt vill kika. Vill du ha ett riktigt skydd behövs något mer än namnet, till exempel en gemensam släktkod eller en egen kod per person. Säg till så lägger vi till det.
2. **Du som kör lottningen kan i teorin öppna alla lappar** (du känner namnen och har filerna). Verktyget visar inte resultatet, men tekniskt går det. Titta inte.
3. **Sidan och repot är publika.** GitHub Pages kan kräva ett publikt repo beroende på kontotyp, och då är all kod och alla krypterade lappar publika. Antalet personer går att läsa av antalet filer i `docs/data/`, men inte vilka de är.
4. **Filen `Actors` finns kvar i historiken.** Den lades in i repot i början (14 för- och efternamn, inga andra uppgifter som mejl, telefon eller koder) och togs sedan bort, men den finns kvar i git-historiken. Är repot publikt kan alla se de namnen i historiken. Vill du ändå ta bort dem behövs en omskrivning av historiken, vilket du i så fall bestämmer själv.
5. **Det går inte att se vilka som har öppnat sin lapp.**
6. **Det finns ingen väntetid eller spärr vid fel namn.** Ett felstavat namn ger bara "Vi hittar inte det namnet". Den som inte hittar sig själv får kolla stavningen (och att hen skriver samma namn som du lade in) eller fråga dig.
7. Lottningen är slumpad men inte exakt jämnt fördelad över alla tänkbara lottningar när det finns många undantag. Det har ingen praktisk betydelse här.
