# Customer Credit Manager

## 1. Firebase
1. Create a Firebase project.
2. Enable Authentication > Email/Password.
3. Create a Firestore Database.
4. Add a Web App and copy its config into `firebase-config.js`.
5. Create your first user in Firebase Authentication.
6. Publish the Firestore rules from `firestore.rules`.

## 2. GitHub Pages
Upload all files to a GitHub repository.
Go to Settings > Pages > Deploy from branch > main / root.
Open the generated GitHub Pages address.

## 3. Important
The WhatsApp function currently opens a WhatsApp message with the customer's balance. It does not silently send messages through WhatsApp servers. Automatic sending requires WhatsApp Business Cloud API.

## Data model
customers/{customerId}
- name
- whatsapp
- address
- ownerId
- createdAt

transactions/{transactionId}
- customerId
- ownerId
- type: credit | debit
- amount
- note
- createdAt
