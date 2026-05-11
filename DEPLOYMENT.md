# AI Physique Judge Deployment

Deploy the backend and frontend separately. Keep `OPENAI_API_KEY` only on the backend.

## Recommended Backend Hosts

Use Render or Railway for the Node/Express backend. Both support long-running API requests, environment variables, and public HTTPS URLs.

## Backend Environment

Set these on Render or Railway:

```bash
OPENAI_API_KEY=sk-...
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

Notes:
- Render and Railway may set `PORT` automatically. That is OK because `server.js` uses `process.env.PORT`.
- `FRONTEND_ORIGIN` can be a comma-separated list if needed:

```bash
FRONTEND_ORIGIN=https://your-app.vercel.app,https://your-custom-domain.com
```

## Deploy Backend On Render

1. Push this project to GitHub.
2. Create a new Render Web Service.
3. Select the repo.
4. Use:
   - Build command: `npm install`
   - Start command: `npm run backend`
5. Add environment variables:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://your-frontend-domain.com`
6. Deploy.
7. Test:

```text
https://your-backend.onrender.com/api/health
https://your-backend.onrender.com/api/openai-test
```

## Deploy Backend On Railway

1. Create a Railway project from GitHub.
2. Add the same environment variables.
3. Set start command to:

```bash
npm run backend
```

4. Deploy and copy the public backend URL.

## Frontend Environment

For local dev:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

For production frontend:

```bash
VITE_API_BASE_URL=https://your-backend-url.com
```

Do not set `OPENAI_API_KEY` in frontend hosting. Never use `VITE_OPENAI_API_KEY`.

## Deploy Frontend

Use Vercel, Netlify, Render Static Site, or Railway static hosting.

Build command:

```bash
npm run build
```

Publish directory:

```text
dist
```

Set frontend environment variable:

```bash
VITE_API_BASE_URL=https://your-backend-url.com
```

After deployment, update backend `FRONTEND_ORIGIN` to the final frontend domain.

## Final Testing Checklist

1. Open backend health:
   - `/api/health`
   - Confirm `apiKeyExists: true`.
2. Open OpenAI test:
   - `/api/openai-test`
   - Confirm output is `OK`.
3. Open the frontend app.
4. Upload a clear physique image.
5. Confirm image validation works.
6. Generate a report.
7. Confirm report saves to history.
8. Test on iPhone Safari using the production frontend URL.
9. Test on Android Chrome.
10. Confirm no API key appears in browser code or browser network payloads.
