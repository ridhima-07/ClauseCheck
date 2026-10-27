# ClauseCheck

**AI-powered document review that highlights what deserves your attention before you sign.**

ClauseCheck helps users understand text-based PDF agreements. It identifies relevant clauses, explains why they matter, checks their supporting evidence against the original document, and returns an annotated PDF for download.

Built as a college project focused on practical AI integration, document processing, evidence grounding, and a clear review experience.

## Features

- Upload and review text-based PDF agreements.
- Read a document summary and dynamically identified clause categories.
- Explore findings with exact source text, page references, plain-language explanations, and why each clause matters.
- Distinguish verified evidence, recovered page references, and unresolved items requiring manual checking.
- Filter and paginate findings alongside an annotated PDF viewer.
- Download a highlighted copy while preserving the original document.
- Use responsive landing, upload, and review screens with Lavender/Dusk themes.

## Attention levels

| Level | Meaning | PDF treatment |
| --- | --- | --- |
| **HIGH ATTENTION** | Deserves specific examination before agreeing. | Light red highlight |
| **REVIEW** | Important to understand or verify. | Light yellow highlight |
| **ROUTINE** | No special attention needed based on document context. | Unchanged |

These levels represent review priorities, not legal judgments or guarantees.

## How it works

1. Validate the upload and extract text with page information using PyMuPDF.
2. Ask Gemini to identify the document type, summary, relevant categories, and evidence-backed findings in structured JSON.
3. Validate the response with Pydantic.
4. Locate evidence using deterministic text matching and page recovery.
5. Separate grounded findings from unresolved items requiring manual review.
6. Annotate grounded clauses and return the analysis with a Base64-encoded PDF.
7. Display the results and enable PDF preview and download in the browser.

Categories are determined from each agreement rather than selected from a fixed universal list. Partial excerpt matches alone do not qualify a finding as fully verified.

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, TypeScript, PDF.js |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| AI | Gemini API through the official Google GenAI SDK |
| PDF processing | PyMuPDF |
| Deployment target | Vercel frontend and Render backend |

## Supported documents and limits

Designed for agreements such as employment/internship agreements, freelance contracts, rental agreements, NDAs, and service agreements.

| Constraint | Limit |
| --- | --- |
| File format | Text-based PDF |
| File size | 10 MB |
| Pages | 50 |
| Extracted text | 150,000 characters |

Scanned/image-only PDFs, OCR, password-protected PDFs, accounts, document history, and collaboration are outside the current scope. AI output can be incomplete or incorrect; source verification does not establish legal accuracy.

## Source layout

The commands below assume `backend/` and `frontend/` are directly inside the project root.

| Path | Purpose |
| --- | --- |
| `backend/main.py` | API, validation, Gemini integration, grounding, and annotation |
| `backend/schemas.py` | Structured analysis and response models |
| `backend/requirements-lock.txt` | Pinned Python dependencies |
| `frontend/src/` | Screens, API client, PDF viewer, and styles |
| `frontend/package-lock.json` | Locked frontend dependency versions |

## Run locally

### Requirements

- Python 3.11
- Node.js 22.12 or later and npm
- A Gemini API key with access to the configured model

### Backend

From the project root on macOS/Linux:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements-lock.txt
```

Create a local `.env` in the project root. Substitute your own key locally; never commit it:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
ALLOWED_ORIGINS=http://localhost:5173
```

Start from the project root so imports such as `backend.schemas` resolve:

```bash
python -m uvicorn backend.main:app --reload
```

API: `http://localhost:8000` • Interactive API documentation: `http://localhost:8000/docs`

### Frontend

In a second terminal, from the project root:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`.
Open `http://localhost:5173`.

To type-check and build the frontend:

```bash
npm run build
```

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Backend only | Gemini API authentication |
| `GEMINI_MODEL` | Backend | Model ID; defaults to `gemini-3.5-flash-lite` |
| `ALLOWED_ORIGINS` | Backend | Comma-separated allowed frontend origins; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | Frontend build | Backend origin without `/analyze`; required in production |

Frontend environment variables are public build configuration. Never put an API key in a `VITE_` variable. Rebuild/redeploy the frontend after changing its API URL.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic service check |
| `POST` | `/analyze` | Analyze a PDF sent as multipart form field `file` |

The analysis response includes `document_type`, `summary`, `findings`, `unresolved_findings`, `unresolved_count`, and `highlighted_pdf_base64`. Grounded findings have `VERIFIED` or `RECOVERED` status; unresolved findings are presented separately for manual checking.

## Deployment configuration

For the source layout above:

| Setting | Render backend | Vercel frontend |
| --- | --- | --- |
| Root directory | Repository root; leave blank | `frontend` |
| Runtime/preset | Python 3 | Vite |
| Install/build | `python -m pip install -r backend/requirements-lock.txt` | Install: `npm ci`; build: `npm run build` |
| Start | `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT` | Static hosting |
| Output directory | Not applicable | `dist` |
| Health-check path | `/` | Not applicable |

Set Render's `PYTHON_VERSION` to the exact tested Python 3.11 patch version. Configure the backend key and model in Render. Set `VITE_API_BASE_URL` to the Render HTTPS origin before building on Vercel, then set Render's `ALLOWED_ORIGINS` to the stable Vercel production origin.

The frontend uses hash navigation and calls Render directly. No API proxy or additional frontend route rewrite is needed for the current implementation.

Free hosting is intended for light demonstration use and remains subject to provider limits. Render Free sleeps after inactivity, so the first request may be slower. The frontend currently allows 120 seconds per analysis request; the Gemini request has a 60-second timeout. Before a demo, open the backend root URL and wait for its JSON response, then test an upload through the frontend.

## Data handling

ClauseCheck does not implement persistent document storage or a database. Results are held in frontend memory and cleared on refresh. Theme preferences may be retained separately from document data.

Extracted document text is sent to Google's Gemini API for analysis. Application-level non-persistence does not imply zero retention by infrastructure or AI providers; their applicable terms and data policies still apply. Use non-sensitive sample agreements for public demonstrations.

## Deployment verification

- Confirm the backend root returns `{"message":"ClauseCheck API"}`.
- Upload a sample agreement through the deployed frontend.
- Check the summary, grounded findings, page references, and any manual-checking items.
- Verify PDF preview, filtering, pagination, themes, and mobile layout.
- Download and open the highlighted PDF.
- Check invalid-file handling and the first upload after backend inactivity.
- Confirm refreshing clears the analysis results.

## Disclaimer

> **ClauseCheck would not present itself as a lawyer, legal advisor, or replacement for professional legal review.**
