# Deploy Aethra CRM

The target architecture is a Vite frontend on Vercel, an Express API on Render, and application data plus uploaded files in MongoDB Atlas. These instructions describe configuration; they do not imply that a live deployment already exists.

## 1. Prepare MongoDB Atlas

Use the intended Atlas organization and project. Create or select a cluster, then create an application database user with `readWrite` on a dedicated `aethra_crm` database. Keep credentials in the platform's secret controls.

Allow the Render service's outbound addresses in Atlas Network Access. Avoid opening the cluster to every IP when restricted outbound ranges are available. A connection string must include the dedicated database name. Never commit it or paste it into chat.

If using the Atlas plugin, an Organization Owner must enable AI client access under **Organization Settings → App Connections**. Read and write access is needed for data setup through the plugin. This setting is separate from the application's database user and network access list.

Existing installations need a verified database migration. Preserve record IDs, password hashes, auth versions, role links, indexes, and attachment references. Copy the actual local upload bytes into GridFS and update the corresponding Upload storage metadata before switching traffic. Moving database metadata alone does not move filesystem files. Keep the local installation intact until the deployed accounts, documents, and files have been verified.

For an empty installation, initialize only the owner account using the documented bootstrap command. Do not run demo seeding on production or replace existing accounts.

Application startup creates missing built-in role definitions without adding demo users, clients, tracks or services. Existing role permissions are retained. For a fresh installation that keeps only existing administrator logins, copy only those two account records and retain their password hashes; leave historical work data in the source installation.

## 2. Deploy the API on Render

Use [render.yaml](../render.yaml) from the repository's `main` branch and the intended Render workspace. The Blueprint defines one API service; the database remains in Atlas and the frontend remains in Vercel.

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Runtime | Node.js 22 |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health path | `/api/health` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas secret, including database name |
| `JWT_SECRET` | Generated secret, retained across deployments |
| `CLIENT_URL` | Actual production Vercel origin |
| `UPLOAD_STORAGE` | `mongodb` |
| `TRUST_PROXY_HOPS` | `1` for Render's proxy; review if adding another proxy layer |
| `BUSINESS_TIMEZONE` | `Africa/Cairo` |

Validate the Blueprint with `render blueprints validate render.yaml`. Review the infrastructure plan before applying it, then wait for the deploy to become live. `/api/health` returns 200 only when MongoDB is connected and 503 when it is unavailable.

The Blueprint selects Render's free plan for initial evaluation and creates no paid resources. Free services can sleep when idle; this delays the first request and pauses in-process SLA checks. Choose an approved always-on plan before relying on continuous background assignment. No persistent Render disk is needed for new MongoDB-backed uploads.

## 3. Configure and deploy the frontend on Vercel

Verify the connected Vercel account/team before creating the project. Generate configuration using the API origin Render actually assigned:

```sh
node scripts/configure-vercel.mjs https://YOUR-ACTUAL-API.onrender.com
```

The script writes `client/vercel.json`. Commit that file before importing the repository into Vercel. Select the **client** root directory, **Vite** framework, `npm run build`, and **dist** output directory.

The configuration proxies `/api/*` to Render and serves the React entry point for frontend routes. API responses are private and are not cached. This keeps authentication cookies, downloads, and event streams on the frontend's public origin. The API origin is public configuration; MongoDB and signing secrets belong only on the backend.

Set Render's `CLIENT_URL` to the final Vercel production origin. The frontend does not need the Atlas connection string or JWT signing secret. Generate the configuration again if the API hostname changes.

## 4. Verify before handing over

- Confirm the actual deployed commit and wait for both platforms to report a successful deployment.
- Check `/api/health` through the Vercel origin, then open a frontend route directly and refresh it.
- Verify the owner and Admin logins, protected account visibility, operational role boundaries, and logout.
- Submit a controlled intake, verify routing/triage and track isolation, and remove or archive the test request through normal application controls.
- Upload and download a permitted file; verify unauthorized download denial, voice seeking, and the selected public logo.
- Restart the API and confirm the uploaded bytes still load from Atlas. Verify notification streaming through Vercel.
- Confirm migrated record counts, relationships and file availability against the source before switching real work.

Keep database backups enabled and include the GridFS collections in recovery checks. A Render or Vercel build artifact is not a database backup.
