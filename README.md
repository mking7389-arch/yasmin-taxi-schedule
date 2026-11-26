# Yasmin Taxi – schemaapp

Flutter-app för iOS och Android där anställda loggar in och ser sina arbetspass. Administratörer kan lägga in och ta bort pass. Backend är Firebase Authentication och Cloud Firestore.

## Kom igång

1. Installera [Flutter](https://docs.flutter.dev/get-started/install) och skapa ett Firebase-projekt.
2. Aktivera **Authentication → Email/Password** och skapa en **Cloud Firestore**-databas.
3. Installera FlutterFire CLI och konfigurera projektet från repo-roten:

   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```

   Välj iOS och Android. Kommandot skapar `lib/firebase_options.dart` (den filen är projektspecifik och ska inte hittas på eller checkas in med hemliga servernycklar).
4. Lägg till initiering i `lib/main.dart` genom att importera `firebase_options.dart` och använd `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)`. Alternativt följ FlutterFire-guiden för plattformarnas native-konfiguration.
5. Publicera reglerna i `firestore.rules` till Firestore (Firebase Console → Firestore → Rules).
6. Kör `flutter pub get` och `flutter run`.

## Första admin och anställdkonton

Skapa konton i Firebase Console → Authentication → Users med e-post och lösenord. Skapa sedan dokument i Firestore-kollektionen `users`, med dokument-ID lika med användarens Authentication UID:

```json
{"role":"admin","name":"Yasmin"}
```

För anställda, använd `role: "employee"`. Administratörer kan skapa arbetspass genom att ange den anställdes UID i appen. Anställda ser endast pass där `employeeId` är deras eget UID. Skapa aldrig adminrollen från en oskyddad klient; rollen sätts av en betrodd administratör i Firebase Console.

## Datamodell

- `users/{uid}`: `role` (`admin` eller `employee`), valfritt `name`.
- `schedules/{id}`: `employeeId`, `employeeName`, `startAt`, `endAt`, `note`, `createdAt`.

Appen är en startversion. Lägg till Firebase-konfiguration för ditt eget projekt innan du kör den.
