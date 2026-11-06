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

```bash
git pull

# Backend
cd backend
npm ci
npm run build
pm2 restart back            # first time: pm2 start dist/server.js --name back

# Frontend
cd ../frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.arklifeproject.com npm run build
pm2 restart front           # first time: pm2 start npm --name front -- start
```

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
Upload ─► Processing ─► (no usable text?) ─► OCR Processing ─► Indexed
                                                          └──► Failed (error shown, Retry available)
```

- PDFs with embedded text are read directly. Scanned PDFs and photos (JPG/PNG) go through Tesseract OCR (Italian and English).
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
