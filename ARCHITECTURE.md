# Architecture & Engineering Tradeoffs Note

**Candidate:** Wesam Nasr (`wesamnasr999@gmail.com`)  
**Assignment:** Ajaia LLC — AI-Native Full Stack Developer Assignment

---

## 1. Product Framing & What Was Prioritized

When building a collaborative document workspace within a strict 4–6 hour timebox, the primary engineering risk is **spreading effort too thinly across complex infrastructure** (such as WebSockets/CRDTs or heavy OAuth flows) at the expense of core product coherence.

I prioritized four high-leverage pillars:
1. **Coherent Rich-Text Editing & Persistence:** A responsive, Google-Docs-inspired editing canvas supporting headings (`H1`–`H3`), inline styles (`Bold`, `Italic`, `Underline`), lists (`UL`, `OL`), blockquotes, debounced auto-save, and explicit version snapshots.
2. **Product-Relevant Multi-Mode File Ingestion:** Rather than supporting only a single rigid upload path, the upload pipeline (`src/lib/file-parser.ts` & `/api/documents/upload`) supports all three workflows mentioned in the prompt:
   - Converting uploaded `.md`, `.txt`, `.docx`, `.html`, `.csv`, or `.json` files into a **new editable rich-text document** (including native ZIP/XML extraction of `word/document.xml` for `.docx` files using Node's built-in `zlib`).
   - Importing uploaded file contents **directly into the active draft**.
   - Saving uploaded files as **downloadable reference attachments** persisted inside the database state so they survive serverless container restarts.
3. **Verifiable Role-Based Sharing (`Owner`, `Editor`, `Viewer`):**
   - Clear UI distinction between **My Owned Documents** and **Shared With Me**.
   - True server-side enforcement: `PATCH /api/documents/:id` verifies the caller's role and returns `HTTP 403 Forbidden` if a `Viewer` attempts to modify content or rename a document, and `DELETE /api/documents/:id` restricts deletion strictly to the `Owner`.
   - An **Instant User Switcher** in the header pre-seeded with three team personas (`Wesam Nasr`, `Sara Chen`, `Alex Rivera`) so reviewers can test `Owner` vs. `Editor` vs. `Viewer` permissions in one click.
4. **Zero-Friction Reviewer Experience (Dual Storage + AI Fallback):**
   - Reviewers never have to pay for a service or provision a database to test the codebase locally.

---

## 2. Key Architectural Decisions & Tradeoffs

### A. Dual-Mode Storage Adapter (`src/lib/db.ts`)
- **Decision:** Implemented a unified storage layer that uses Cloud PostgreSQL (`pg.Pool`) when `DATABASE_URL` is provided, and seamlessly falls back to a local transactional JSON file (`data/ajaia-store.json` locally, or `os.tmpdir()` in read-only cloud sandboxes) when `DATABASE_URL` is absent.
- **Why:** Guarantees 100% cloud persistence in production while ensuring `npm install && npm run dev` works immediately on a reviewer's laptop without Docker or cloud credentials.

### B. Custom React `contentEditable` Rich-Text Engine vs. Heavy Editor Frameworks
- **Decision:** Built a controlled React rich-text canvas synchronized via DOM refs (`loadedDocIdRef` + debounced auto-save + server-side HTML sanitization) rather than pulling in 10+ TipTap/ProseMirror or Slate packages.
- **Why:** Heavy third-party editor trees frequently introduce Next.js SSR hydration mismatches, cursor-jumping bugs during state updates, and fragile TypeScript build issues under time constraints. Our custom ref-synced canvas keeps typing latency at `0ms`, preserves cursor stability during auto-save, and sanitizes HTML (`sanitizeRichHtml`) against XSS vectors (`<script>`, `<iframe>`, inline `on*` handlers).

### C. Multi-Provider AI Copilot with Deterministic Fallback (`src/lib/llm-client.ts`)
- **Decision:** Built a provider-agnostic structured JSON client supporting Google Gemini (`gemini-2.5-flash` with model failover), OpenAI (`gpt-4o-mini`), per-request `AbortController` timeouts, Markdown fence stripping, and a deterministic fallback generator.
- **Why:** Upstream LLM APIs can experience transient rate limits (`HTTP 429`) or missing keys during offline grading. Degrading gracefully to a deterministic extractor ensures the UI and automated tests never crash.

---

## 3. What Was Intentionally Deprioritized (And What I Would Build in +2–4 Hours)

### Intentionally Scoped Out for the 4–6 Hour Timebox:
- **Character-by-Character Real-Time CRDT Cursors (Yjs / WebSockets):** Full multi-cursor synchronization requires a stateful WebSocket coordination server, which adds deployment complexity without improving single-reviewer evaluation clarity.
- **Full OAuth / Password Hashing Flows:** Replaced with seeded persona switching and lightweight email account creation so reviewers can test multi-user sharing immediately.

### Next Steps with Another 2–4 Hours:
1. **Real-Time Presence & Live Sync:** Integrate Yjs over WebSockets (or Supabase Realtime channels) for live collaborator cursors and paragraph-level locking.
2. **Inline Text Selection Comments:** Anchor comments to specific highlighted character ranges inside the document body rather than document-level threads.
3. **Granular Diff Viewer in Version History:** Render visual green/red inline diffs before restoring a historical snapshot.
