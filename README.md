# Guide til Didaktisk Julekalender (JS Version)

Denne guide hjælper dig med at forstå projektets struktur, og hvordan du bruger editoren til at vedligeholde indholdet i din julekalender. Projektet er nu 100% offline-kompatibelt og bruger `content.js` til at lagre data.

## Projektstruktur

Projektet er organiseret i mapper for at gøre det mere overskueligt:

- **/css/**: Indeholder `style.css`, som styrer alt det visuelle design.
- **/js/**: Indeholder `script.js` (for selve kalenderen) og `editor.js` (for redigeringsværktøjet).
- **/assets/**: Indeholder billeder og andre mediefiler, f.eks. `logo.png`.
- **index.html**: Hovedsiden for julekalenderen, som brugerne skal se.
- **editor.html**: Den side, du bruger til at redigere indholdet.
- **content.js**: Den vigtigste fil, der indeholder al data (titler, tekster, billeder osv.) til alle 24 låger i form af en JavaScript-variabel.

---

## Sådan bruges Editoren

Editoren (`editor.html`) er dit primære værktøj til at styre indholdet i julekalenderen uden at skulle røre ved koden.

> **Vigtigt:** Editoren er kun til lokalt brug og behøver ikke at blive uploaded til en webserver sammen med den færdige julekalender.

### 1. Start Editoren
Åbn `editor.html` i din webbrowser (f.eks. Google Chrome, Firefox). Editoren indlæser automatisk det eksisterende indhold fra `content.js`. Hvis du har ugemte ændringer fra en tidligere session, vil du blive spurgt, om du vil gendanne dem.

### 2. Generelle Indstillinger

Øverst i editoren finder du de generelle indstillinger for hele kalenderen:

-   **Hovedtitel**: Kalenderens primære overskrift.
-   **Undertitel**: Teksten der vises lige under hovedtitlen.
-   **Logo URL**: Stien til logoet. Skal typisk være `assets/dit-logo.png`.
-   **Rækkefølge af Låger:**
    *   Du kan manuelt ændre rækkefølgen af lågerne ved at trække og slippe dem i grid-visningen.
    *   Knappen **"Bland Rækkefølgen Nu"** genererer en ny, tilfældig statisk rækkefølge. Husk at gemme dine ændringer bagefter.
-   **Aktivér Test-tilstand (alle låger kan åbnes):** Brug denne afkrydsningsboks til at slå test-tilstand til eller fra. Når den er aktiveret, kan alle låger åbnes uanset datoen.

### 3. Vælg en Dag
Brug dropdown-menuen til at vælge den dag (1-24), du vil redigere. Hvis der allerede er indhold for den dag, vil det blive indlæst i felterne.

### 4. Rediger Dagens Information
-   **Titel**: Den overskrift, der vises i toppen af modal-vinduet, når lågen åbnes.
-   **Emoji**: Den emoji, der vises ved siden af titlen. Du kan nu vælge en emoji fra en forbedret vælger, som erstatter eksisterende emoji i stedet for at tilføje.

### 5. Rediger Indholdsblokke
Hver låges indhold er bygget op af "blokke". Du kan tilføje, fjerne og ændre rækkefølgen af disse blokke.
-   **Tilføj en blok**: Klik på en af knapperne nederst (f.eks. "Tilføj Spørgsmål", "Tilføj Billede") for at tilføje en ny blok til bunden.
-   **Fjern en blok**: Klik på den røde "Fjern"-knap i øverste højre hjørne af en blok. Du vil blive bedt om at bekræfte handlingen.
-   **Ændr rækkefølge**: Klik og hold på ikonet med de to lodrette rækker af prikker (`<i data-lucide="grip-vertical"></i>`) i øverste venstre hjørne af en blok, og træk den op eller ned.

### 6. Gem dine ændringer

-   **Autosave:** Editoren gemmer automatisk dine fremskridt lokalt i din browser hvert sekund, du arbejder. Hvis du lukker browseren ved et uheld, vil du blive tilbudt at gendanne dine ændringer næste gang du åbner editoren.
-   **Manuel gem (Generer `content.js`):** Når du er færdig med at redigere, klik på den store blå knap **"Generer og Download content.js"**. Dette gemmer alle dine ændringer (både generelle indstillinger og indholdet for alle dage, du har redigeret) til en fil.
-   **VIGTIGT:** Denne nye fil skal du flytte ind i roden af dit projekt og erstatte den gamle `content.js`-fil. Først da vil dine ændringer være synlige i selve julekalenderen (`index.html`).

> **Tip:** Du kan bruge "Test Låge"-knappen i editoren for at se en forhåndsvisning af den dag, du arbejder på, før du gemmer.

---

## Live-tilstand vs. Test-tilstand

Kalenderen styrer, om lågerne er låst baseret på datoen, medmindre Test-tilstand er aktiveret:

-   **Test-tilstand (Aktiv via editor):** Hvis du har slået "Aktivér Test-tilstand" til i editoren, kan alle låger åbnes, uanset datoen. Dette er ideelt til udvikling og test før december.
-   **Live-tilstand (Deaktiveret via editor):** Hvis Test-tilstand er slået fra, vil kalenderen opføre sig som en rigtig julekalender:
    *   **Før 1. december:** Alle låger er låst, og kalenderen viser en status om, at den kan åbnes fra den 1. december.
    *   **Fra 1. december:** Lågerne kan kun åbnes på den korrekte dato (f.eks. kan låge 5 først åbnes den 5. december).

Du har altså nu fuld kontrol over kalenderens tilstand direkte fra editoren!

---

## Manuel redigering af `content.js` (For avancerede brugere)

Du kan også redigere `content.js` direkte i en teksteditor. Filen indeholder et enkelt JavaScript-objekt kaldet `calendarData`. Sørg for at bevare den korrekte syntaks.

`content.js` er hjernen i kalenderen. Det er en JavaScript-fil, der indeholder et stort objekt. Hver "nøgle" i dette objekt er et tal fra 1 til 24, som repræsenterer en dag i kalenderen. Værdien for hver dag er et objekt med en `title`, en `emoji` og en `body`-liste. `body`-listen indeholder de indholdsblokke, der vises i lågen.

Nedenfor er en guide til de forskellige blok-typer.

### `question`
Viser en simpel tekstblok, der er formateret som et spørgsmål eller et princip.
- **`value`**: En streng med din tekst.
```javascript
{
  "type": "question",
  "value": "Hvordan kan vi bruge formativ evaluering til at fremme elevens læring?"
}
```

### `answer`
Viser en simpel tekstblok, der er formateret som et svar.
- **`value`**: En streng med din tekst.
```javascript
{
  "type": "answer",
  "value": "Ved løbende at indsamle information om elevens forståelse og bruge den til at justere undervisningen og give specifik feedback."
}
```

### `html`
Giver dig mulighed for at indsætte rå HTML-kode. Bruges til speciel formatering, links, lister osv.
- **`value`**: En streng indeholdende gyldig HTML.
```javascript
{
  "type": "html",
  "value": "Læs mere om formativ evaluering på <a href='https://www.google.com' target='_blank'>denne side</a>.<ul><li>Punkt 1</li><li>Punkt 2</li></ul>"
}
```

### `image`
Indsætter et billede.
- **`value`**: Stien til billedet (f.eks. `assets/mit-billede.jpg`).
- **`alt`**: En alternativ tekst, der beskriver billedet.
```javascript
{
  "type": "image",
  "value": "assets/evaluering.png",
  "alt": "En illustration af en evalueringscyklus"
}
```

### `quiz`
En interaktiv multiple-choice quiz med øjeblikkelig feedback.
- **`value`**: Et objekt med fire felter:
    - **`question`**: Spørgsmålsteksten.
    - **`options`**: En liste af strenge med svarmulighederne.
    - **`correctIndex`**: Tallet på det korrekte svar i `options`-listen. **Vigtigt:** Det første svar er `0`, det andet er `1`, osv.
    - **`explanation`**: Den tekst, der vises som forklaring, efter brugeren har svaret.
```javascript
{
  "type": "quiz",
  "value": {
    "question": "Hvad står 'A' for i S.M.A.R.T.-modellen?",
    "options": [
      "Attraktivt",
      "Ambitiøst",
      "Accepteret / Achievable",
      "Analyseret"
    ],
    "correctIndex": 2,
    "explanation": "Helt korrekt! 'A' står for Achievable (Opnåeligt) eller Acceptabelt."
  }
}
```
*De øvrige blok-typer (`video`, `citat`, `custom-box`, `refleksion`) følger et lignende mønster og kan inspiceres i `content.js` for eksempler.*