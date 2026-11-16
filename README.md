# Släktens Secret Santa

En enkel webbsida där släkten kan se vem de ska ge julklapp till. Allt ligger i det här repot och
visas via GitHub Pages. Det finns ingen server, ingen databas, ingen inloggningstjänst och inga
externa tjänster, bara GitHub och webbläsarens inbyggda kryptering.

**Så fungerar det:** Du (admin) lottar en gång på din egen dator. Verktyget skapar en krypterad
"lapp" per person. Lapparna läggs i repot. När en person väljer sitt namn och skriver sin
4-siffriga kod på sidan, öppnas lappen i personens egen webbläsare. Lottningen i klartext finns
aldrig i repot, i loggar eller på någon server.

> Läs avsnittet [Begränsningar](#begränsningar-läs-detta) innan du kör på riktigt.

---

## Det här gör du, steg för steg

### 1. Testa lokalt (valfritt men rekommenderas)

Du behöver Python 3 (finns på Mac och de flesta Linux-datorer; på Windows kan du installera det från python.org).

```bash
cd docs
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000/` (deltagarsidan) och `http://localhost:8000/admin/` (admin) i webbläsaren.
Avsluta med Ctrl+C i terminalen.

Admin-sidan måste öppnas via `localhost` eller `https://`. Dubbelklicka inte på filen
(`file://` fungerar inte, webbläsaren stänger då av krypteringen).

**Testa med "Fyll med testnamn"** så får du se hela flödet med påhittade namn. Ladda **inte** upp testdata
till det riktiga repot. Om du gör det av misstag: gör en ny, riktig lottning och ersätt `data/` (se nedan).

### 2. Slå på GitHub Pages

1. Se till att koden ligger på grenen `main` (slå ihop arbetsgrenen med `main`, t.ex. via en pull request på GitHub).
2. Gå till repot på GitHub → **Settings → Pages**.
3. Under *Build and deployment*: **Source = Deploy from a branch**, **Branch = `main`**, mapp **`/docs`** → **Save**.
4. Efter någon minut visas adressen högst upp på sidan, ungefär `https://ANVÄNDARNAMN.github.io/REPONAMN/`.
   Den adressen ska du skriva in i admin-verktyget.

### 3. Öppna admin-sidan

Kör den helst lokalt (steg 1): `http://localhost:8000/admin/`. Den finns även på
`https://ANVÄNDARNAMN.github.io/REPONAMN/admin/`, men den innehåller inga hemligheter och gör inget förrän du matar in namn. Det går bra att köra den därifrån också.

### 4. Lägg in släkten, undantag och lotta

1. Klistra in namnen, **för- och efternamn, ett per rad**. Radnummer och `;` i slutet gör inget.
   Dubbletter varnas för. Två personer med samma namn måste skiljas åt (t.ex. med ett mellannamn).
2. **Undantag:** välj två personer i listorna och tryck *Lägg till undantag* (t.ex. par som inte ska dra varandra). Det gäller åt båda håll.
3. Kryssrutan **Inga ömsesidiga byten** är på som standard (A ger till B och B ger till A förbjuds).
   Går det inte med regeln får du en tydlig varning och lottningen görs utan den.
4. Skriv in sidans **publika adress** från steg 2.
5. Tryck **Lotta**. Du ser bara "Lottning klar, X filer skapade". Verktyget visar aldrig vem som fick vem, och du ska inte försöka ta reda på det.
6. Ladda ner de två filerna:
   - **ZIP med `data/`**: ska in i repot.
   - **`utskick.txt`**: ett färdigt meddelande per person, med personens PIN.

> **VIKTIGT:** `utskick.txt` innehåller alla PIN-koder. Checka **aldrig** in den i repot och lägg den inte i någon delad mapp.
> Skicka varje persons meddelande till just den personen och radera sedan filen. Den och alla `.zip` är
> redan utpekade i `.gitignore`, så `git` hoppar över dem om du använder det.

### 5. Lägg in `data/` i repot

Packa upp ZIP-filen. Du får en mapp `data`. Den ska ligga i `docs/`, alltså `docs/data/`.

**Via GitHub-webben:**
1. Gå till mappen `docs` i repot → **Add file → Upload files**.
2. Dra in mappen `data` från din dator (innehållet ska hamna i `docs/data/`). Skriv ett meddelande och tryck **Commit changes**.

**Via git:**
```bash
git rm -r --ignore-unmatch docs/data   # tar bort gamla lappar om det finns några
# packa upp ZIP-filen så att mappen data hamnar i docs/
git add docs/data
git commit -m "Ny lottning"
git push
```

Efter någon minut fungerar sidan. Prova själv med din egen kod (men titta inte på någon annans!).

### 6. Skicka ut meddelandena

Öppna `utskick.txt`, kopiera varje persons meddelande och skicka det privat till just den personen (SMS, Messenger, vad som helst).
Radera sedan `utskick.txt`.

### 7. Om någon hoppar av, någon tillkommer eller något går fel

Gör en **ny lottning**: kör steg 4–6 igen med den nya namnlistan. En ny lottning ger:
- nya slumpade filer och **nya PIN-koder till alla**. Alla måste alltså få ett **nytt utskick**, och de gamla koderna slutar fungera.
- Ta bort de gamla lapparna ur `docs/data/` (hela mappen) innan du lägger in de nya. Gör du det via webben: öppna `docs/data`, tryck på `…`-menyn och välj *Delete directory*. Gamla lappar som lämnas kvar ligger publikt, och den som har sin gamla kod kan öppna dem.

Om någon bara **glömt sin kod**: skicka personens meddelande igen från din `utskick.txt` (om du sparat den) eller gör en ny lottning.

---

## Inställningar

`docs/config.js` har sidans rubrik, namnet som visas vid "Glömt koden? Fråga …" och antalet iterationer i nyckelhärledningen
(se nedan). Ändringar där kräver att du committar filen.

## Tekniska detaljer

- `docs/lib/draw.js`: lottning. Slumpad backtracking med kryptografisk slump (`crypto.getRandomValues`). Hittar en lösning om det finns en, och ger annars ett felmeddelande om vilka regler som krockar.
- `docs/lib/crypto.js`: PBKDF2-HMAC-SHA256 (nyckel av `id:PIN` + slumpad salt, 1 000 000 iterationer), AES-256-GCM med slumpad IV och personens id som AAD. Namnet paddas till exakt 64 byte så att alla filer är lika stora. Fel PIN och trasig fil ger samma svar: "Fel kod".
- Id:n och filnamn är slumpade och inte härledda från namn.
- Samma `lib/`-kod körs i Node (tester), admin-verktyget och deltagarsidan.
- Sidorna har strikt Content-Security-Policy (`default-src 'self'`), `no-referrer`, `noindex`. Inget laddas från andra adresser, och inget sparas i webbläsaren (ingen localStorage, inga cookies).
- Antalet iterationer är valt för att en dekryptering ska ta ca 0,5 till 1 sekund på en medelgod mobil. Det är en uppskattning, jag har inte kunnat mäta på riktiga telefoner. Känns det för långsamt eller snabbt: ändra `iterations` i `docs/config.js` och lotta om.

### Köra testerna

```bash
npm test
```

Kräver Node 20+ och inga installationer. Testerna använder bara påhittade namn.

---

## Begränsningar (läs detta)

1. **En 4-siffrig PIN går att knäcka av någon som aktivt försöker.** Lapparna ligger publikt, och det finns ingen server som kan spärra felförsök. Det finns bara 10 000 möjliga koder. Den långsamma nyckelhärledningen gör varje gissning dyrare, men den som vill kan prova alla koder för en lapp på kort tid med lite hårdvara. Väntetiden på sidan (2 s, 4 s, 8 s …) är bara en **gardin på klientsidan** och inget riktigt skydd: den försvinner om man laddar om sidan eller bygger ett eget program. Det här är rimligt skydd mot nyfikna släktingar, inte mot någon som vill hacka sig in.
2. **Du som kör lottningen känner alla PIN-koder** (de står i `utskick.txt`) och kan i teorin öppna alla lappar. Titta inte. Verktyget visar inte resultatet, men tekniskt går det.
3. **Namnlistan (`participants.json`) och sidan är publika.** Vem som helst som hittar adressen ser namnen i listan (inte vem som drog vem). GitHub Pages kan kräva ett publikt repo beroende på kontotyp, och då är all kod och alla krypterade lappar också publika. Repot har dessutom en tidigare version med namnlistan i historiken (filen `Actors`, som sedan togs bort).
4. **Det går inte att se vilka som har öppnat sin lapp**, och en glömd PIN kan bara lösas genom att du skickar PIN:en igen från ditt utskick eller gör en ny lottning.
5. Lottningen är slumpad men inte exakt jämnt fördelad över alla tänkbara lottningar när det finns många undantag. Det har ingen praktisk betydelse för det här ändamålet.
