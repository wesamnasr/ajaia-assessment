# Ajaia LLC — AI-Native Full Stack Developer Assignment Submission

**Candidate:** Wesam Nasr (`wesamnasr999@gmail.com`)  
**Project:** **Ajaia Docs** — AI-Native Collaborative Rich-Text Document Workspace

---

## 1. Submission Links & Package Manifest

- **Live Deployed Product URL:** `[LIVE_DEPLOYMENT_URL_HERE]`
- **Google Drive Deliverable Folder:** `[GOOGLE_DRIVE_FOLDER_LINK_HERE]`
- **Walkthrough Video URL (3–5 min):** `[WALKTHROUGH_VIDEO_URL_HERE]`

### Included Files in Deliverable Package:
1. `src/` — Full Next.js 14 (App Router) + TypeScript frontend, backend API routes, dual-storage engine (`src/lib/db.ts`), multi-format file parser (`src/lib/file-parser.ts`), and multi-provider AI client (`src/lib/llm-client.ts`).
2. `tests/api.test.mjs` — 5 end-to-end automated integration test suites covering CRUD, rich-text persistence, `.md`/`.txt` file upload workflows, role-based sharing (`Owner` / `Editor` / `Viewer` `HTTP 403` enforcement), version history restore, comments, and AI fallback resilience.
3. `README.md` — Local setup instructions, seeded user credentials, supported file formats, and API reference.
4. `ARCHITECTURE.md` — System design note detailing prioritization, technical tradeoffs, and next production steps.
5. `AI_WORKFLOW.md` — Detailed note on AI tools used, where AI accelerated delivery, what AI output was modified/rejected, and verification methodology.
6. `SUBMISSION.md` — This complete submission manifest and evaluation guide.
7. `WALKTHROUGH_VIDEO_URL.txt` — Walkthrough video link and structured outline.
8. `screenshots/` — High-resolution screenshots of the working application flows.

---

## 2. Seeded Test Accounts (For Instant Sharing & Permission Review)

No password entry or external OAuth setup is required. Use the **Active User Switcher** in the top navigation bar (or click **+ User** to add any email address) to test multi-user ownership and sharing immediately:

| Account Name | Email | User ID | Seeded Workspace State |
| :--- | :--- | :--- | :--- |
| **Wesam Nasr** | `wesam@ajaia.ai` | `user-wesam` | **Owner** of *Ajaia Q4 AI Product Strategy*; **Editor** on *Engineering Spec*; **Viewer (Read-Only)** on *Compliance Audit* |
| **Sara Chen** | `sara.chen@ajaia.ai` | `user-sara` | **Owner** of *Engineering Spec*; **Editor** on *Q4 Product Strategy* & *Compliance Audit* |
| **Alex Rivera** | `alex.rivera@ajaia.ai` | `user-alex` | **Owner** of *Compliance Audit*; **Viewer (Read-Only)** on *Q4 Product Strategy* & *Engineering Spec* |

---

## 3. Local Setup & Verification Instructions

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Copy environment variables
cp .env.example .env

# 3. Start the application locally (http://localhost:3000)
npm run dev

# 4. Run the 5 automated end-to-end integration test suites
npm test

# 5. Verify production build
npm run build
```
*(Zero paid services or external database containers are required: when `DATABASE_URL` is omitted, `src/lib/db.ts` automatically persists to `data/ajaia-store.json` with pre-seeded users and documents; when `GEMINI_API_KEY` is omitted, `src/lib/llm-client.ts` gracefully uses deterministic fallback mode.)*

---

## 4. Feature Status: What Is Working, Intentional Scope Cuts & Next Steps

### Fully Working End-to-End:
- **Document Creation & Rich-Text Editing:** Create, rename inline, edit, auto-save, and reopen documents with **Bold**, **Italic**, **Underline**, **Headings (`H1`–`H3`)**, **Blockquotes**, **Bulleted Lists**, **Numbered Lists**, Undo/Redo, and live word/character counts.
- **Multi-Mode File Upload (`.txt`, `.md`, `.markdown`, `.docx`, `.html`, `.htm`, `.csv`, `.json` up to 2 MB):**
  1. Convert uploaded file into a **new editable rich-text document** (including native ZIP/XML extraction for `.docx` files).
  2. Import file content **into the currently open draft**.
  3. Attach reference files to a document with one-click download.
- **Role-Based Sharing (`Owner`, `Editor`, `Viewer`):**
  - Distinct **My Owned Documents** vs. **Shared With Me** sidebar sections.
  - Grant or revoke `Editor` or `Viewer` access via seeded teammate buttons or email invite.
  - Enforced both in the UI (read-only lock banner) and on the backend (`HTTP 403 Forbidden` when a `Viewer` attempts `PATCH` or `DELETE`).
- **Stretch Features Included:**
  - **AI Document Copilot:** Summarize, extract action items, polish tone, or expand outlines and insert formatted HTML directly into the document.
  - **Version History:** Automatic and manual snapshots with one-click restore.
  - **Collaborative Comments:** Post and resolve review threads per document.
  - **Export:** One-click download as **Markdown (`.md`)** or **Print / Save as PDF**.

### Intentionally Scoped Out (Deliberate Timebox Tradeoffs):
- **Real-Time Multi-Cursor WebSockets / CRDTs (Yjs):** Deprioritized in favor of rock-solid persistence, server-enforced role permissions, and multi-mode file ingestion that a single reviewer can verify deterministically.
- **Heavy External OAuth Flows:** Replaced with instant persona switching so reviewers can evaluate multi-user sharing in seconds.

### What I Would Build Next with Another 2–4 Hours:
1. **Live WebSocket Presence & Paragraph Locking:** Show active collaborator cursors in real time and broadcast edits across browser tabs via WebSockets / Supabase Realtime.
2. **Inline Text-Range Anchored Comments:** Attach comment threads to highlighted text selections inside the editor canvas.
3. **Visual Diff Viewer in Version History:** Highlight added/removed paragraphs before restoring a historical snapshot.
