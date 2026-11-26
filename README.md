# Yasmin Taxi – schema och personal

Mobilanpassad webbapp för Yasmin Taxi. Anställda loggar in och ser sina arbetspass. Administratören ser veckoschemat med en egen färg för varje anställd och kan lägga till eller ta bort pass. Webbappen fungerar i webbläsaren på iPhone, Android och dator.

## Publicera webbappen

Först behöver du ett Firebase-projekt (gratisnivån räcker för att börja):

1. Öppna [Firebase Console](https://console.firebase.google.com/) och skapa projektet.
2. I projektinställningarna lägg till en **Web App** (`</>`). Kopiera dess konfigurationsvärden.
3. Gå till **Authentication → Sign-in method** och aktivera **Email/Password**.
4. Gå till **Firestore Database** och skapa en databas.
5. I repot öppna **Settings → Secrets and variables → Actions → New repository secret**. Lägg till dessa sex secrets med värden från Firebase web app:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
6. Kör publiceringen från terminalen med Node.js installerat:

   ```bash
   cp .env.example .env.local
   # Fyll i värdena från Firebase i .env.local
   npm install
   npm run build
   npx firebase-tools login
   npx firebase-tools deploy --only hosting
   ```

   Firebase hosting är konfigurerat att publicera den statiska webbappen från `out/`. Firebase visar webbplatsens adress efter publicering. Lägg också till den domänen i **Authentication → Settings → Authorized domains** om det behövs.

   Obs: värdena i Firebase web app-konfigurationen används av klientappen. Säkerheten kommer från Authentication och Firestore-reglerna, inte från att gömma web app-konfigurationen. Publicera aldrig Firebase Admin service-account-nycklar i repot.

## Skapa administratör och anställda

Konton skapas i Firebase Console → **Authentication → Users → Add user**. För varje konto, kopiera dess UID och skapa i Firestore ett dokument i `users` med dokument-ID exakt lika med UID:

```json
{"name":"Yasmin","email":"yasmin@example.com","role":"admin"}
```

För anställda används `"role":"employee"`, till exempel:

```json
{"name":"Anna Andersson","email":"anna@example.com","role":"employee"}
```

Adminrollen ska skapas manuellt av en betrodd projektägare i Firebase Console. Webbappen låter inte användare själva registrera sig eller ge sig adminbehörighet. När anställdkontona har skapats visas deras namn i adminens färgkodade schema och i listan när ett nytt pass läggs till.

## Firestore-datamodell

- `users/{uid}`: `name`, `email`, `role` (`admin` eller `employee`).
- `schedules/{id}`: `employeeId`, `employeeName`, `startAt`, `endAt`, `note`, `createdAt`, `createdBy`.

Publicera säkerhetsreglerna från `firestore.rules` till Firestore → **Rules**. Reglerna gör att en anställd bara kan läsa egna pass och att endast administratörer får hantera scheman.

## Lokal utveckling

Skapa `.env.local` från `.env.example`, fyll i Firebase-värdena och kör:

```bash
npm install
npm run dev
```

Öppna `http://localhost:3000`. Webbappen visar en konfigurationsguide tills Firebase-värdena finns.

Den befintliga Flutter-startversionen ligger kvar i `lib/` och `pubspec.yaml`.
