# Firebase Setup

## 1. Create a Firebase project

- Go to the Firebase console.
- Create a new project.
- Add a Web app to the project.
- Copy the Firebase web config values into `.env.local`.

## 2. Create your local env file

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

## 3. Enable Firestore

- Open Firestore Database in Firebase.
- Create the database in production mode or test mode.
- Choose a region close to your users.

## 4. Suggested Firestore collection

Use a collection named `recordings`.

Each document should look like:

```json
{
  "title": "Swarm composition",
  "notes": "Behavior description",
  "events": [],
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

## 5. Starter security rules

These are intentionally simple for development and should be tightened before a public launch:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recordings/{recordingId} {
      allow read, write: if true;
    }
  }
}
```

## 6. Next step for production

- Add Firebase Authentication
- Save `userId` on recordings
- Change Firestore rules so users can only edit their own recordings
