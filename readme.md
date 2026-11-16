# Virtual Bestie 2.0 — bijgewerkte bestanden

Deze versie verwijdert het decoratieve blokje onderaan de zijbalk (de uitlogknop staat nu bovenaan) en maakt fouten van de AI-chat duidelijk zichtbaar.

## Bestanden vervangen op GitHub

Vervang in de hoofdmap:
- `index.html`
- `style.css`
- `app.js`

Vervang in de map `functions`:
- `functions/index.js`

Laat `firebase.js`, `login.html`, `login.js`, `firebase.json`, `database.rules.json` en `functions/package.json` staan zoals ze zijn, tenzij je bewust een andere Firebase-configuratie gebruikt.

## Waarom de chat eerder niets terugstuurde

De website slaat een bericht op in Firebase en vraagt daarna een Firebase Cloud Function om de AI-reactie. Alleen publiceren via GitHub Pages voert die serverfunctie niet uit. De Cloud Function moet ook naar Firebase worden gedeployed en de API-sleutel moet als Firebase Secret zijn ingesteld.

## AI-chat activeren of opnieuw publiceren

Een ouder/verzorger of de beheerder van het project moet het AI-account, de API-sleutel en eventuele gebruikskosten beheren. Zet de sleutel nooit in GitHub of in `app.js`/`firebase.js`.

In een terminal, vanuit de projectmap:

```bash
firebase login
firebase use bestelwebsitenl
cd functions
npm install
cd ..
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions
```

Voer de API-sleutel alleen in bij de beveiligde terminalprompt. Niet in de websitecode, GitHub-bestanden of een chatbericht.

De function gebruikt `europe-west1`, dezelfde regio als de website. Hij gebruikt de OpenAI Responses API met model `gpt-6-luna`. Beschikbaarheid hangt af van het API-account; als dit model niet beschikbaar is, moet de projectbeheerder een model kiezen dat het API-account wel mag gebruiken.

## Hoe je ziet wat er nog misgaat

Na het uploaden toont de chat nu een duidelijke melding:
- AI-functie nog niet gepubliceerd: deploy de Firebase Function.
- API-sleutel/model niet juist: controleer Firebase Secret en modeltoegang.
- Limiet bereikt: controleer API-gebruik en billing-instellingen.
- Andere serverfout: bekijk Firebase Functions Logs.

Chatberichten worden in de Realtime Database opgeslagen. Recente berichten worden naar de AI-provider gestuurd om een antwoord te genereren. De function vraagt `store: false` aan; dit schakelt niet de opslag van chatgeschiedenis in je eigen Firebase-database uit.

## Privacy

Laat geen wachtwoorden, thuisadres, telefoonnummer, schoolnaam of andere gevoelige informatie achter in de chat. AI-antwoorden kunnen fouten bevatten.
