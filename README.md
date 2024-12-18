# CargoConnect (brug branch main-v2)

En mobilapplikation til at lave avanceret profitmaksimering, samt forbinde chauffører med virksomheder, der har brug for transporttjenester.

## Styles

Vi har valgt ikke at implementere en stor global styles fil, da det blev uoverskueligt i takt med udvidelse af projektet. I stedet har vi valgt en komponentbaseret stylingtilgang, hvor hver komponent har styles i samme fil. Til videreudvikling af projektet, kunne en mere modulær opbygning af styles være en fordel ved yderligere skalering.

## Ruteoptimering

Applikationen laver ruteoptimering baseret på følgende komponenter:

### Distance Beregning
- Primær: Google Routes Matrix API til præcis afstand og køretid mellem alle punkter
- Fallback: Haversine formel (fugleflugtslinje med jordens krumning) hvis API ikke er tilgængelig

### Optimering med NVIDIA CUOPT
- Vehicle Routing Problem (VRP) løsning via NVIDIA CUOPT
- Tager højde for:
  - Tidsvinduer for leveringer
  - Køre/hviletidsregler
  - Lastkapacitet
  - Servicetid ved stop
  - Prioriteter på leveringer
  - Multiple depoter
  - Betaling
- Optimerer for:
  - Minimering af total køretid/distance
  - Maksimering af antal leverede pakker
  - Balancering af arbejdsbyrde mellem chauffører

## Funktionaliteter

### Min side (Chauffør)
- Indtastning af personlige oplysninger
- Indtastning af nummerplade
- "Scanning" (billedeupload) af kørekort
- Indtastning af lastkapacitet til rutegenerering
- Visning af nuværende rating
- Indtastning af startlokation og arbejdstid
- Præferenceindstillinger

### Min side (Virksomhed)
- Oprettelse af arbejdsopgaver med titel, billede, beskrivelse og pris
- Valg af start- og slutdestination via adresse eller kort
- Angivelse af datofrister
- Modtagelse af chaufførtilbud og accept af enkeltchauffører
- Favoritchauffører liste

### Opgavehåndtering
- Liste og kortvisning af tilgængelige opgaver
- Detaljeret opgavevisning med placering, estimeret indtjening og virksomhedens rating
- Mulighed for at acceptere eller afvise opgaver
- Statusoverblik og afslutning af opgaver

### Kapacitetsstyring
- Indtastning og visning af eksisterende ruter
- Filtrering af opgaver efter tilgængelig kapacitet

### Kommunikation og Notifikationer
- Push notifikationer om nye opgaver og statusopdateringer

## Teknisk Stack
- **React Native med Expo**
- **Firebase**
  - Authentication
  - Realtime Database
- **GeoCode Maps API**
- **Google Maps Distance Matrix API**

## Opsætning

### 1. Klon projektet og installer dependencies
```bash
git clone [repository-url]
cd CargoConnect
npm install
```

### 2. Firebase Opsætning
- Opret et nyt Firebase projekt på Firebase Console
- Aktiver Authentication med email/password
- Aktiver Realtime Database
- Download Firebase konfigurationsfilen

### 3. Opret .env fil
Opret en .env fil i roden af projektet med følgende variabler:

```plaintext
# Firebase Config
FIREBASE_API_KEY=din-api-nøgle
FIREBASE_AUTH_DOMAIN=dit-projekt.firebaseapp.com
FIREBASE_DATABASE_URL=https://dit-projekt.firebaseio.com
FIREBASE_PROJECT_ID=dit-projekt-id
FIREBASE_STORAGE_BUCKET=dit-projekt.appspot.com
FIREBASE_MESSAGING_SENDER_ID=din-sender-id
FIREBASE_APP_ID=din-app-id

# GeoCode Maps API
GEOCODE_MAPS_APIKEY=din-geocode-api-nøgle

# Google Maps (Valgfrit - bruges til ruteoptimering. Fallback er "Haversine" - fugleflugt med jordens hældning indregnet)
GOOGLE_MAPS_API_KEY=din-google-maps-api-nøgle
```

### 4. Start Udviklingsserveren
```bash
npx expo start
```

## Database Struktur
```plaintext
├── users/
│   └── [userId]/
│       ├── dimensions/
│       │   ├── height
│       │   ├── length
│       │   └── width
│       ├── licensePlate
│       ├── maxCargoWeight
│       ├── role: "trucker" | "company"
│       ├── startLatitude
│       ├── startLongitude
│       └── vehicleId
├── deliveries/
│   └── [deliveryId]/
│       ├── companyId
│       ├── deliveryAddress
│       ├── deliveryDetails
│       ├── deliveryLocation/
│       │   ├── latitude
│       │   └── longitude
│       ├── earliestStartTime
│       ├── height
│       ├── isMandatory
│       ├── latestEndTime
│       ├── length
│       ├── payment
│       ├── pickupAddress
│       ├── pickupLocation/
│       │   ├── latitude
│       │   └── longitude
│       ├── priority
│       ├── prize
│       ├── requests/
│       │   └── [truckerId]/
│       │       ├── licensePlate
│       │       ├── rating
│       │       ├── requestTime
│       │       ├── routeId
│       │       ├── truckType
│       │       ├── truckerName
│       │       └── truckerProfile
│       ├── serviceTime
│       ├── status
│       ├── weight
│       └── width
├── notifications/
│   └── [userId]/
│       └── [notificationId]/
│           ├── deliveryId
│           ├── message
│           ├── status
│           ├── timestamp
│           ├── truckerId
│           └── type
└── routes/
    └── [userId]/
        ├── distances
        ├── durations
        └── locations
```