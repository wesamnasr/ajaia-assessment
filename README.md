# Ajaia Docs — AI-Native Collaborative Document Workspace

**Author:** Wesam Nasr (`wesamnasr999@gmail.com`)  
**Live Deployed URL:** https://ajaia-docs-pearl-seven.vercel.app  
**GitHub Repository:** https://github.com/wesamnasr/ajaia-assessment  
**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Dual-Storage Engine (Cloud Postgres + Automatic Local Persistence), Multi-Provider LLM Pipeline (Google Gemini / OpenAI + Deterministic Fallback)

---

## 1. Overview & Core Capabilities

**Ajaia Docs** is a lightweight collaborative document editor inspired by Google Docs, designed to help distributed product and engineering teams draft, format, import, share, and review specifications rapidly.

### What Works End-to-End:
1. **Rich-Text Document Creation & Editing:**
   - Create new documents, rename titles inline, edit rich-text content in the browser, auto-save changes, and record manual version snapshots.
   - **Formatting Toolbar:** Bold (`Ctrl+B`), Italic (`Ctrl+I`), Underline (`Ctrl+U`), Headings (`H1`, `H2`, `H3`), Normal Paragraph, Callout Blockquote, Bulleted Lists, Numbered Lists, Undo/Redo, and Clear Formatting.
2. **Multi-Mode File Upload Workflow (`.txt`, `.md`, `.docx`, `.html`, `.csv`, `.json`):**
   - **Mode A — Turn File Into a New Editable Document:** Parses Markdown headings/lists, plain text paragraphs, CSV rows, or Word `.docx` XML paragraphs (`word/document.xml`) into a formatted rich-text document.
   - **Mode B — Import File Content Into Current Draft:** Appends formatted file contents directly into the currently open document.
   - **Mode C — Attach Reference File:** Associates the uploaded file with the document so collaborators can download it anytime.
   - **Supported File Types & Limits:** Explicitly supports `.txt`, `.md`, `.markdown`, `.docx`, `.html`, `.htm`, `.csv`, and `.json` up to **2 MB** per file.
3. **Role-Based Sharing & Access Control (`Owner`, `Editor`, `Viewer`):**
   - Clear separation in the left sidebar between **My Owned Documents** and **Shared With Me**.
   - **Owner:** Full control (edit content, rename title, grant/revoke `Editor` or `Viewer` permissions, delete document).
   - **Editor:** Can edit rich-text content, rename title, upload/import files, post comments, and restore version snapshots, but cannot delete the document or alter owner sharing settings.
   - **Viewer (Read-Only):** Can read, export (`.md` / `PDF`), download attachments, and post comments; editing is locked in the UI and strictly rejected by the backend API with `HTTP 403 Forbidden`.
4. **Persistence Across Refreshes & Environments:**
   - **Dual-Mode Storage Adapter (`src/lib/db.ts`):** Uses Cloud Postgres (`DATABASE_URL`) when configured in production, and automatically falls back to a local transactional JSON store (`data/ajaia-store.json`) so reviewers can run the app locally with zero external database setup.
5. **Stretch Enhancements & AI-Native Copilot:**
   - **AI Document Copilot:** One-click *Summarize Document*, *Extract Action Items*, *Polish Tone*, and *Expand Specification* with direct `+ Insert Into Doc` support.
   - **Version History & One-Click Restore:** Every creation, file import, and manual snapshot is recorded and restorable.
   - **Collaborative Comments:** Post and resolve review comments per document.
   - **Export:** One-click export to **Markdown (`.md`)** or **Print / Save as PDF**.

---

## 2. Seeded Test Accounts (For Instant Sharing Evaluation)

To make evaluating ownership and sharing effortless without typing passwords, the top navigation bar includes an **Instant User Switcher** pre-populated with three team accounts (plus a `+ User` button to create any custom email account):

| User ID | Name | Email | Default Role & Seeded Access |
| :--- | :--- | :--- | :--- |
| `user-wesam` | **Wesam Nasr** | `wesam@ajaia.ai` | **Owner** of *Ajaia Q4 AI Product Strategy*, **Editor** on *Engineering Spec*, **Viewer** on *Compliance Audit* |
| `user-sara` | **Sara Chen** | `sara.chen@ajaia.ai` | **Owner** of *Engineering Spec*, **Editor** on *Q4 Product Strategy* & *Compliance Audit* |
| `user-alex` | **Alex Rivera** | `alex.rivera@ajaia.ai` | **Owner** of *Compliance Audit*, **Viewer (Read-Only)** on *Q4 Product Strategy* & *Engineering Spec* |

---

## 3. Local Setup & Run Instructions

### Prerequisites
- **Node.js** `>= 20.0.0` (tested on Node.js 22)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables (Optional)
```bash
cp .env.example .env
```
- `GEMINI_API_KEY` *(Optional)*: Enables live Google Gemini inference for the AI Copilot. If omitted, the server automatically uses a deterministic fallback so all features work out of the box without paid keys.
- `DATABASE_URL` *(Optional)*: PostgreSQL connection string. If omitted, the server persists all documents, shares, comments, attachments, and versions to `data/ajaia-store.json`.

### Step 3: Start the Development or Production Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### Step 4: Run Automated Integration Tests
```bash
npm test
```
Runs the end-to-end integration test suite (`tests/api.test.mjs`) against an isolated temporary store, verifying document CRUD, rich-text persistence, `.md`/`.txt` file upload workflows, role-based sharing enforcement (`403 Forbidden` for Viewers), version restoration, and AI resilience.

---

## 4. API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Storage mode, AI readiness, and seeded entity counts |
| `GET` / `POST` | `/api/users` | List seeded accounts or create/switch to a custom collaborator account |
| `GET` / `POST` | `/api/documents` | List `owned` and `shared` documents for `userId`, or create a new document |
| `GET` / `PATCH` / `DELETE` | `/api/documents/:id` | Read, update (`Owner`/`Editor` only), or delete (`Owner` only) a document |
| `POST` / `DELETE` | `/api/documents/:id/shares` | Grant `editor` or `viewer` access by user ID or email, or revoke access |
| `POST` | `/api/documents/upload` | Upload `.txt`, `.md`, `.docx`, `.html`, `.csv`, `.json` as new doc, inline import, or attachment |
| `POST` / `PATCH` | `/api/documents/:id/comments` | Add or resolve collaborative document comments |
| `POST` | `/api/documents/:id/versions` | Restore a previous document version snapshot |
| `POST` | `/api/ai/assist` | Run structured AI document summarization, action extraction, polishing, or expansion |
