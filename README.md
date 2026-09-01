# ISP Online Management System

Starter web system using Flask + Excel (.xlsx) as the data store.

## Run locally
1. Install Python 3.10+.
2. `pip install -r requirements.txt`
3. `python app.py`
4. Open `http://127.0.0.1:5000`

If the Users sheet is empty, a demo Admin is created:
- Username: `admin`
- Password: `Admin@12345`

Change this immediately in a real deployment.

## Important
Excel is being used here as a simple single-file datastore. It is not recommended for heavy concurrent production traffic. For a real ISP system with many simultaneous users, migrate the same tables to MySQL/PostgreSQL.

## Included
- Login/session
- Admin / Manager / NTO roles
- Admin creates Manager/NTO; Manager creates NTO
- Admin enable/disable
- Bundle submission and Pending/Approved/Rejected
- Sales Report page
- Complaints page
- Excel database template
- Password hashing
