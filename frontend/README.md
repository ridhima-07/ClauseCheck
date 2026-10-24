# ClauseCheck — connected frontend

## Run locally

Use Node.js 22.12 or later. Keep the backend and frontend running in separate terminals.

### Backend (unchanged)

From your existing project root (the folder containing `backend/`), activate your existing backend virtual environment and start:

```bash
uvicorn backend.main:app --reload
```

The backend needs your existing Gemini environment configuration. Do not put API keys in the frontend. Confirm `http://localhost:8000/` returns `{"message":"ClauseCheck API"}`.

### Frontend

From this `frontend` folder:

```bash
npm ci
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`, because the backend permits this exact origin). The API URL defaults to `http://localhost:8000`. To change it, copy `.env.example` to `.env.local`, edit `VITE_API_BASE_URL`, and restart Vite. This variable is public configuration, not a secret.

Select a text-based agreement PDF and click Analyze. On success the integration confirmation screen shows the real document type, summary, grounded/unverified counts and a highlighted PDF download. The detailed review workspace is the next checkpoint.

## Implemented

- Approved landing page styling and upload themes/spacing retained.
- Real `File` state, no fictional demo states or simulated requests.
- Multipart `POST /analyze` using the field `file`. Browser-managed multipart boundary.
- Handles empty browser MIME metadata while preserving bytes; backend validates the PDF.
- Prevents duplicate requests and file changes during analysis.
- Parses and checks the actual backend response, retaining all unresolved findings and source fields.
- Displays backend error messages, handles network/non-JSON errors, and permits manual retry with the selected file.
- No automatic retries. A 120-second client deadline prevents endless waiting; Gemini has a separate 60-second backend timeout. A client timeout or navigation abort does not guarantee backend processing stops.
- Leaving the upload screen aborts its browser request; late results do not navigate back.
- Analysis is held in `App` memory, never localStorage. Refresh clears it; a direct result URL without data returns to Upload. Theme preference alone is persisted.
- Decodes the returned Base64 into a downloadable PDF and releases its object URL.

## Files to understand

- `src/api.ts`: backend types, runtime response checks, upload request, PDF download.
- `src/UploadPage.tsx`: selected file, loading/error state and request lifecycle.
- `src/App.tsx`: navigation and in-memory result ownership.

## Verify with your backend

1. Upload a valid agreement: confirm one POST, success data and a PDF that opens with highlights.
2. Try the backend's empty/invalid/locked/blank/disguised-image fixtures. Errors should display; file replacement should remain available.
3. Stop the backend and submit: a connection error should appear, with retry available.
4. Test slow responses, switching themes, long filenames, mobile widths and navigation away during processing.
5. Reload the success screen: it should return to upload rather than inventing/restoring results.

Validation here: TypeScript and production build passed; mocked request checks cover multipart bytes/field/MIME, success/unresolved contracts, malformed response rejection, HTTP errors, non-JSON failure, network failure and abort propagation. Live Gemini and browser interaction checks still need your local environment.

## Build and deploy later

```bash
npm run build
```

Vite's default preview port 4173 is not in the current backend CORS list. For a local build preview use `npm run preview -- --host localhost --port 5173 --strictPort` after stopping the dev server.

For deployment, set `VITE_API_BASE_URL` to the deployed backend HTTPS URL before building and add the deployed frontend origin to FastAPI CORS. The backend analysis pipeline needs no changes for this local integration.
