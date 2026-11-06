# ArkLife AI: current state and Milestone 3 upgrade

Section 6 of the Milestone 3 specification asks for documentation of the AI as it was before the upgrade, and of what changed.

## 1. State before Milestone 3 (audit)

| Question | Answer |
|---|---|
| **AI model** | Google Gemini `gemini-3.6-flash`, called via `@google/genai` (Interactions API) from `backend/src/controllers/chat.controller.ts` |
| **How documents were indexed** | Upload → text extracted inline during the HTTP request (pdfjs for PDF, mammoth for DOCX, plain read for TXT/MD/JSON) → split into ~800-character chunks → stored as plain text in MongoDB (`MemoryChunk`). There were no embeddings and no OCR. There was a 30 s timeout and a 5 MB limit. |
| **How information was retrieved** | A keyword (TF-IDF) score over all of the user's chunks, returning the **top 3 chunks** (`keywordResearchService.ts`). The tokenizer was ASCII-only, so Italian accented words (è, più, attività) were broken, and there were no Italian stopwords. |
| **Conversation history** | **None.** Messages were saved to MongoDB for display only. Each question was sent to the model alone, so the AI could not follow a conversation. |
| **System prompt** | `You are <avatar name>. Persona: <description>` plus the 3 chunks, plus the instruction **"Respond in 1-2 short sentences"**. There was no health role, no safety rules and no source attribution. |
| **External AI services** | Gemini (chat), ElevenLabs (voice cloning and TTS), D-ID (avatar video). OpenAI embeddings code existed but was unused. Replicate was used only by a test route. |

### Why the AI felt "dumb"

1. The 1–2 sentence limit made every answer superficial and evasive.
2. With no history, every message was treated as a brand-new conversation.
3. With only 3 keyword-matched chunks, questions spanning several documents were impossible. "Compare my last three blood tests" needs every report, not 3 fragments.
4. There was no instruction to admit missing information, so the model could guess.
5. Scanned PDFs produced no text, so the AI never saw them, and they stayed stuck in "Indexing".

## 2. Milestone 3 architecture

```
User message
  │
  ├─ last 16 messages (conversation memory)            ← Message collection
  ├─ document context                                   ← MemoryVault + MemoryChunk
  │     • catalogue of ALL the user's documents (name, type, date, source)
  │     • if total text ≤ 120k chars → FULL text of every document, newest first
  │     • otherwise → top 10 keyword-matched excerpts, labelled with their document
  └─ system instruction (role, persona, language, sources, safety)
  │
  ▼
Gemini (generateContent: systemInstruction + multi-turn contents)
  │
  ▼
Reply + list of documents used (shown under the message in the chat)
```

### System instruction (summary)

- **Role:** ArkLife's health and well-being mentor (nutrition, supplements, sleep, exercise, lifestyle) and a capable general assistant. The avatar persona is layered on top.
- **Language:** always reply in the user's language (usually Italian).
- **Sources:** facts from the user's documents are introduced with "📄 Dai tuoi documenti" and must name the document and its date. General knowledge is introduced with "💡 Conoscenza generale".
- **No invention:** if information is not in the documents, the AI says so and lists the documents it has.
- **Comparisons:** a table or list of values per date, with the largest changes and out-of-range values highlighted.
- **OCR caution:** implausible values must be checked against the original.
- **Safety:** not a substitute for a doctor. No diagnoses and no prescriptions or dosages. Worrying findings → see a doctor. Emergencies → 112.
- **Style:** usually 2–6 sentences. Longer only for analyses, since replies can be read aloud.

### Retrieval improvements

- Full-document mode covers the typical MVP user (a few reports) with no retrieval errors at all.
- Excerpt mode is the fallback for large archives. The tokenizer is now Unicode-aware and has Italian stopwords, and excerpts carry their document name.
- Clinical documents are user-wide. Personal memories can be scoped to one avatar.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.6-flash` | Model name |
| `CHAT_HISTORY_MESSAGES` | 16 | Previous messages sent as memory |
| `CHAT_FULL_CONTEXT_CHARS` | 120000 | Threshold for full-document mode (~30k tokens) |

### Cost note

Full-document mode sends up to ~30k input tokens per message. With Gemini Flash that is a fraction of a cent per message. Lower `CHAT_FULL_CONTEXT_CHARS` to reduce cost, or enable Gemini context caching later.

## 3. Acceptance tests (spec §10.6)

| Test | How to verify |
|---|---|
| Normal conversation and context | Ask "Mi chiamo Marco e corro 3 volte a settimana", then "Quante volte corro?" |
| General questions | "Quali sono i benefici del magnesio?" → coherent answer marked as general knowledge |
| Uploaded documents | Upload a blood-test PDF, then ask "Qual è il mio colesterolo LDL?" → value with document name and date |
| Multi-document | Upload 3 blood tests, then "Confronta i miei ultimi tre esami del sangue e dimmi quali valori sono cambiati di più" |
| Scanned report | Upload an image-only PDF → status goes to OCR Processing → Indexed, then ask about a value in it |
| No invention | "Qual è il mio livello di vitamina D?" when it is not in any document → the AI says it is not in the documents |

## 4. Next steps (beyond M3)

- Semantic retrieval (embeddings on an EU-hosted or self-hosted model) for large archives
- Structured extraction of lab values (name, value, unit, range, date) for charts and trends
- Scientific sources (BASE / CORE search) with citations
- Self-hosted LLM option for full data sovereignty
