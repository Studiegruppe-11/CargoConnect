## Opsætning

1. Kør `npm install` i root for at installere alle dependencies.

2. Opret en `.env`-fil i root med følgende format (kræver man har realtime database og authentication sat op i Firebase samt en api-nøgle til  [GeoCode Free Api](https://geocode.maps.co/)):

    ```plaintext
    FIREBASE_API_KEY=
    FIREBASE_AUTH_DOMAIN=
    FIREBASE_DATABASE_URL=
    FIREBASE_PROJECT_ID=
    FIREBASE_STORAGE_BUCKET=
    FIREBASE_MESSAGING_SENDER_ID=
    FIREBASE_APP_ID=
    GEOCODE_MAPS_APIKEY=
    ```

3. Start projektet med `npx expo`. Hvis du oplever problemer, kan det hjælpe at rydde cachen ved opstart. Brug evt. `npm start --reset-cache`, da der har været enkelte problemer med Expo CLI.

> **Bemærk:** Ja, det er et nested repository. Nej, det er ikke fedt. Det bliver rykket i andet repository asap.