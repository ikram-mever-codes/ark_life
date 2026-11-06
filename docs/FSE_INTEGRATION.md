# Health Record (FSE) downloader: proposed approach

**Status: proposal. Spec §5 requires the client to approve this before full development.**

## Constraints

- The Italian **Fascicolo Sanitario Elettronico (FSE)** is run by each region. Access requires **SPID, CIE or CNS**.
- There is **no public API** that lets a private company download a citizen's documents on the citizen's behalf. FSE 2.0 interoperability (via the INI gateway) is reserved for accredited healthcare actors.
- SPID login inside our own app would require ArkLife to become an accredited SPID Service Provider through AgID, which takes months, requires legal steps and a technical certification. It is not feasible for the MVP.
- Spec requirement: **ArkLife must never store the user's external credentials.**
- Automating a login on the regional portal ("scraping") would mean handling the user's SPID session on our servers. That breaks the rule above, breaks the portals' terms, and stops working whenever a portal changes.

## Proposed MVP workflow (implemented in M3)

```
ArkLife "Import from FSE"
  1. Opens the official FSE portal (fascicolosanitario.gov.it → user's region)
  2. User logs in directly on the portal with SPID / CIE      ← ArkLife never sees credentials
  3. User downloads the reports they want (PDF)
  4. User selects the PDFs in ArkLife → uploaded with source = "fse", category = clinical
  5. Processing → OCR if scanned → Indexed → available to the AI
```

- This satisfies acceptance criterion §10.5: a health document is retrieved through the intended workflow and imported into ArkLife.
- Imported documents are marked **"FSE"** in Clinical Records and in the AI's document catalogue.
- Each user's data is separated: every document is scoped to the user's account, files are served only through an authenticated endpoint, and nothing is public.

## Future options (post-MVP, need budget and partners)

| Option | What it gives | Requirements |
|---|---|---|
| **SPID/CIE login for ArkLife accounts** | Verified identity in ArkLife | AgID SPID Service Provider accreditation, or a SPID aggregator (e.g. a certified intermediary) |
| **Regional FSE data-sharing agreement** | Automatic download with the patient's consent | Agreement with the region(s), accreditation, DPIA |
| **Patient-mediated export (FHIR)** | Structured data instead of PDFs | Depends on FSE 2.0 regional rollout |

## Decision needed from ArkLife

Please confirm that the guided-import workflow above is the agreed implementation for Milestone 3. The alternatives require external accreditation.
