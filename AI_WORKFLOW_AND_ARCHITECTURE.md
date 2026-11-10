# Architecture, Tradeoffs & AI-Native Workflow Log

**Candidate:** Wesam Nasr (`wesamnasr999@gmail.com`)  
**Role:** AI-Native Full Stack Developer — Ajaia LLC (`Ajaia.ai`)

> Note: Dedicated standalone documents are also available in [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`AI_WORKFLOW.md`](./AI_WORKFLOW.md).

---

## 1. Problem Framing & Core Requirements
- **Primary User Goal:** A lightweight, Google-Docs-inspired collaborative rich-text document workspace enabling teams to create, rename, format, upload/import files (`.txt`, `.md`, `.docx`, `.html`, `.csv`, `.json`), share documents with granular `Owner` / `Editor` / `Viewer` permissions, persist state across refreshes, and leverage an integrated AI Document Copilot.
- **Non-Negotiable Production Qualities:** Data persistence across reloads, server-enforced access control (`HTTP 403` for unauthorized/viewer mutations), HTML sanitization, zero-setup reviewer experience, and automated integration test coverage.

---

## 2. System Architecture & Key Tradeoffs (Under Timebox)
- **Framework & Runtime:** Next.js 14 (App Router) + TypeScript + Tailwind CSS.
- **Dual-Mode Storage Adapter (`src/lib/db.ts`):**
  - Connects to Cloud PostgreSQL (`pg.Pool`) when `DATABASE_URL` is configured, and automatically falls back to a transactional local store (`data/ajaia-store.json`) when running locally without cloud credentials.
  - Pre-seeded with 3 team accounts (`Wesam Nasr`, `Sara Chen`, `Alex Rivera`) and 3 rich collaborative documents demonstrating `Owner`, `Editor`, and `Viewer (Read-Only)` states immediately on launch.
- **Rich-Text Editor & File Ingestion (`src/lib/file-parser.ts`):**
  - Supports Bold, Italic, Underline, Headings (`H1`–`H3`), Blockquotes, Bulleted/Numbered Lists, Undo/Redo, and auto-save.
  - Multi-mode upload workflow converts `.md`, `.txt`, `.docx` (via native `node:zlib` `word/document.xml` extraction), `.html`, `.csv`, and `.json` files into new editable documents, inline draft imports, or downloadable attachments.
- **AI Integration Layer (`src/lib/llm-client.ts`):**
  - Enforces structured JSON output (`summary`, `actions`, `suggestedHtml`), per-request `AbortController` timeouts, and deterministic fallback resilience.

---

## 3. Intentional AI Tooling Workflow (How AI Was Leveraged vs. Human Judgment)
1. **Scaffolding & Boilerplate Acceleration (AI-Assisted):**
   - Used Antigravity AI pair-programming to accelerate Next.js Route Handlers, TypeScript interfaces, and Markdown/HTML conversion utilities.
2. **Architecture & Edge-Case Verification (Human-Led Corrections):**
   - **Replaced React `dangerouslySetInnerHTML` re-renders on `contentEditable`** with imperative DOM ref synchronization (`editorRef` + `loadedDocIdRef`) to prevent cursor-jumping bugs during live typing and auto-save.
   - **Upgraded UI-only read-only locks to strict Backend API guards** (`resolveAccessRole` returning `HTTP 403 Forbidden` when a `Viewer` attempts `PATCH` or `DELETE`).
   - **Caught and fixed a UTC seed timestamp sorting bug via `npm test`** where seeded comments had a future UTC hour relative to the test runner clock.
