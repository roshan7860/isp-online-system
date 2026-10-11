# Customer Credit Manager

Firebase + GitHub Pages customer credit/debit manager.

## Features
- Firebase Email/Password login
- Customer add/edit/delete
- Credit/debit transactions
- Red credit and green debit styling
- Optional WhatsApp message toggle per transaction
- Pashto WhatsApp message with balance/date
- One-click WhatsApp reminder button
- Customer public account link with name, number, balance and transaction history
- Top 5 debtors

## Firebase
1. Enable Authentication > Email/Password.
2. Create Firestore Database.
3. Put your Web App config in `firebase-config.js`.
4. Publish `firestore.rules`.

## GitHub Pages
Upload all project files to the repository root and enable Pages from `main` / root.

## WhatsApp
The system opens a WhatsApp message using `wa.me`. It does not silently send messages through WhatsApp servers. Automatic background sending requires WhatsApp Business Cloud API.

## Public customer portal
Each customer gets a random public token. The link is included in WhatsApp messages and opens `customer.html`, showing the customer's account details and transaction history.
