# ArkLife

ArkLife is an MVP platform for personal health, longevity and personal memory. It has three areas:

| Area | What it covers | Status |
|---|---|---|
| **Clinical** | Medical documents (blood tests, lab and specialist reports), OCR, AI-assisted reading, FSE import | Milestone 3 |
| **Avatar** | Personal memories, biography, voice, photo, conversation with the user's digital companion | Milestones 2–3 |
| **Biometric tracking** | Wearable / longitudinal data | Future milestone |

```
frontend/   Next.js 16 · React 19 · Tailwind 4 · Redux       → app.arklifeproject.com
backend/    Node.js · Express · TypeScript · MongoDB (Mongoose) → api.arklifeproject.com
docs/       AI architecture, FSE integration proposal
```

## Requirements

- Node.js ≥ 20, npm
- MongoDB (Atlas or self-hosted, **EU region**)
- For OCR of scanned documents, on the server:
  ```bash
  sudo apt-get install -y tesseract-ocr tesseract-ocr-ita tesseract-ocr-eng poppler-utils
  ```
- API accounts: Google Gemini (chat), ElevenLabs (voice), Cloudinary (images), D-ID (optional avatar video), an SMTP mailbox

## Local development

```bash
# Backend
cd backend
cp .env.example .env        # fill in the values
npm install
npm run dev                 # http://localhost:8000  (health: /api/health)

# Frontend (second terminal)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:3000
```

## Production deployment (Hostinger VPS, Ubuntu, PM2 + nginx)

One command, from the repository root on the server:

```bash
git pull && bash scripts/deploy.sh
```

[`scripts/deploy.sh`](scripts/deploy.sh) does the following:
1. Refuses to deploy if known injected-code markers are found (see "Security incident" below).
2. Installs the OCR system packages if they are missing (`tesseract-ocr`, `-ita`, `-eng`, `poppler-utils`).
3. Runs `npm ci` and builds the backend and the frontend.
4. Restarts PM2 (`back`, `front`). It runs `node` and `next` directly, never through `package.json` scripts.
5. Health-checks the backend.

- `backend/.env` holds the real secrets on the server. It is git-ignored, so never commit it.
- `NEXT_PUBLIC_API_URL` is baked into the frontend at build time.
- nginx proxies `api.arklifeproject.com` to port 8000 and `app.arklifeproject.com` to port 3000 (TLS via certbot). Set `client_max_body_size 50m;` for document uploads.
- Uploaded files live in `backend/uploads/` (git-ignored). Back this folder up together with the database.

## Environment variables

All variables are documented in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

External services used:

| Service | Used for | Variable |
|---|---|---|
| Google Gemini | AI chat | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| ElevenLabs | Voice cloning and text-to-speech | `ELEVENLABS_API_KEY` |
| Cloudinary | Avatar photos | `CLOUDINARY_*` |
| D-ID | Avatar video (optional) | `DID_API_KEY` |
| SMTP | Verification / reset e-mails | `EMAIL_USER`, `EMAIL_PASS` |
| Tesseract + Poppler | OCR, self-hosted on the server | `OCR_*` |

## Document pipeline (Clinical area)

```
Upload ─► Processing ─► (pages with scanned content?) ─► OCR Processing ─► Indexed
                                                                    └──► Failed (error shown, Retry available)
```

- **PDFs are checked page by page.** A page is OCR'd when it has no real text, or when it contains a large image. That covers a scanned results table under a text letterhead. Pages with real text keep their exact text, and small logos are ignored.
- **Photos (JPG/PNG)** are cleaned before OCR: EXIF auto-rotation, grayscale, contrast stretch, and upscaling of small photos. Pages scanned sideways or upside down are detected and rotated automatically.
- **OCR engines** (`OCR_ENGINE=auto`):
  - With system Tesseract installed, the app uses it (fastest).
  - Otherwise it uses the built-in engine (tesseract.js with bundled Italian and English models). OCR therefore keeps working even when the system packages are missing.
  - Both engines run on our server; no external service is involved.
- Processing runs in the background, one document at a time, with a hard timeout (`DOCUMENT_TIMEOUT_MS`). A document can never stay in "Processing" indefinitely. Documents interrupted by a server restart are re-queued automatically at boot.
- Documents are served only through the authenticated endpoint `GET /api/v1/memory/files/:id/content`. The `uploads/memory` folder is not publicly accessible.

Main endpoints (`/api/v1/memory`, all authenticated):

| Method | Path | Purpose |
|---|---|---|
| POST | `/add-memory` | Upload (`file`, `category=clinical\|personal`, `source=upload\|fse`, `avatarId`) or save `neuralBio` |
| GET | `/vault` | List documents with status |
| GET | `/files/:id/content` | Original file (PDF viewer) |
| GET | `/files/:id/text` | Extracted / OCR text |
| POST | `/files/:id/retry` | Re-process a failed document |
| PATCH | `/files/:id` | Change category |
| DELETE | `/files/:id` | Delete document and its index |

## AI

See [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md).

## Health Record (FSE) import

See [`docs/FSE_INTEGRATION.md`](docs/FSE_INTEGRATION.md).

## Security incident (Nov 2026)

Obfuscated malicious code was found in this project and has been removed:
- in `frontend/postcss.config.mjs`, which Next.js executes on every dev/build (present since April 2026);
- in `backend/init` and `frontend/init`, plus `node init` hooks in `package.json`, force-pushed to `main` from a compromised account.

Rules for this repository:
- Never merge the old `origin/main` until it has been replaced with clean code.
- `scripts/deploy.sh` refuses to deploy if these markers reappear.
- All secrets that were on affected machines (`backend/.env`: database, JWT, API keys, e-mail) must be rotated.
