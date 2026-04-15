# Lost & Found Portal

This project is a working lost-and-found portal built with:

- Frontend: HTML, CSS, JavaScript
- Backend: Python + Flask
- Demo persistence: SQLite
- Production-ready schema included for MySQL in [backend/mysql_schema.sql](/C:/Users/HP/Desktop/Gitdemo/LOST&FOUNDPORTAL/backend/mysql_schema.sql)

## Features

- Lost tab to report and track lost items
- Found tab to report found items
- Finder-only verification answer vault
- Public claimant flow for answering verification questions
- Notification section for updates on lost items, found items, claims, and return status
- Responsive glassmorphism interface

## Run locally

1. Install dependencies:

```powershell
pip install -r requirements.txt
```

2. Start the backend:

```powershell
python backend/app.py
```

3. Open [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Finder-only verification

When a finder submits a found item, the portal generates:

- a `Found Item ID`
- a private `Access Key`

Only the finder who has both values can open the Finder Vault and see:

- the correct answers to verification questions
- all claimant-submitted answers
- item status controls
