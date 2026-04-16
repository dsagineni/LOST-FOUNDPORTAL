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
- Finder accept/reject review controls for each claim
- Claim-status lookup that reveals finder contact only after approval
- Notification section for updates on lost items, found items, claims, and return status
- Real-time dashboard updates through Server-Sent Events, with polling fallback
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
- accept or reject every claim
- item status controls

If a finder accepts a claim, the claimant can check claim status with:

- `Claim ID`
- the same contact value used during submission

Only approved claimants see the positive owner-confirmation message and the finder's contact details.

## Hosting Beyond Localhost

This repository is already configured for `https://github.com/dsagineni/LOST-FOUNDPORTAL.git`.
Push the project to that repo, then deploy it on a Python-capable host such as Render,
Railway, Fly.io, or a VPS.

The backend supports deployment-friendly runtime configuration:

- `HOST` defaults to `0.0.0.0`
- `PORT` defaults to `5000`
- `DATABASE_URL` enables a hosted PostgreSQL database for persistent campus-wide data
- `PORTAL_DATABASE_PATH` lets you move the SQLite database outside the project if needed
- `FLASK_DEBUG=1` enables the Flask dev server

Without `FLASK_DEBUG=1`, the app uses `waitress` so it is better suited for real hosting than the Flask development server.

### Public Deployment Checklist

1. Commit and push to GitHub:

```powershell
git add .
git commit -m "Make portal realtime and deployment ready"
git push origin main
```

2. Create a new web service on your hosting provider from:

```text
https://github.com/dsagineni/LOST-FOUNDPORTAL.git
```

3. Use these commands:

```text
Build command: pip install -r requirements.txt
Start command: python backend/app.py
```

4. Set environment variables:

```text
HOST=0.0.0.0
FLASK_DEBUG=0
PORTAL_DATABASE_PATH=/data/portal.db
```

Use your provider's assigned `PORT` variable if it supplies one automatically.
For persistent public hosting, configure a persistent disk or database and point
`PORTAL_DATABASE_PATH` at that storage. Without persistent storage, uploaded
reports may disappear when the host restarts.

For Render, this repo includes `render.yaml`. Choose **New Blueprint**, connect
this GitHub repository, and set the Blueprint path to `LOST&FOUNDPORTAL/render.yaml`.
Render will use the included build command, start command, and environment
variables. The included blueprint uses Render's free plan with `/tmp/portal.db`,
so the site can deploy without payment. Upgrade to persistent storage later if
reports must survive every host restart.

For permanent data retention, create a hosted PostgreSQL database and set
`DATABASE_URL` in Render to its connection string. When `DATABASE_URL` is present,
the app stores lost items, found items, claims, answers, and notifications in
PostgreSQL. Without it, the deployed free service falls back to temporary SQLite,
which can reset when the host restarts.

### Real-Time Flow

- Public lost/found boards update through `/api/events`.
- Claimants can submit answers and later check claim status with claim ID plus contact.
- Finders unlock the private vault with found item ID plus access key.
- A finder can accept or reject each claim after comparing the claimant's answers with the stored correct answers.
- Only an accepted claim is treated as the real owner.
- Only the accepted claimant sees: `You're the real owner! The finder's contact will be displayed shortly.`
