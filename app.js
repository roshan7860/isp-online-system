rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /customers/{customerId} {
      allow read, write: if request.auth != null;
    }

    match /transactions/{transactionId} {
      allow read, write: if request.auth != null;
    }

    match /public_accounts/{accountId} {
      allow read: if true;
      allow write: if request.auth != null;

      match /transactions/{transactionId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
  }
}
