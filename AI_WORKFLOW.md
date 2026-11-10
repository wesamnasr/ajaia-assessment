# AI-Native Workflow Note

**Candidate:** Wesam Nasr (`wesamnasr999@gmail.com`)  
**Assignment:** Ajaia LLC — AI-Native Full Stack Developer Assignment

---

## 1. AI Tools Used

- **Antigravity IDE (Agentic AI Pair-Programming):** Used for interactive architectural planning, rapid full-stack TypeScript/Next.js scaffolding, route handler generation, and automated test authoring.
- **Google Gemini API (`gemini-2.5-flash`):** Integrated directly into the application (`src/lib/llm-client.ts` & `/api/ai/assist`) to power the in-editor **AI Document Copilot** (document summarization, action-item extraction, tone polishing, and outline expansion).

---

## 2. Where AI Materially Sped Up My Work

1. **Upfront Requirements Decomposition & Interactive Design Alignment:**
   - Before writing application code, I used a structured decision-tree workflow to resolve stack, storage, file-parsing, and permission-model tradeoffs upfront. This prevented mid-build rewrites.
2. **Boilerplate & Route Handler Acceleration:**
   - Accelerated the creation of the 8 Next.js App Router API endpoints (`/api/documents`, `/api/documents/[id]`, `/api/documents/[id]/shares`, `/api/documents/upload`, `/api/documents/[id]/comments`, `/api/documents/[id]/versions`, `/api/users`, `/api/ai/assist`) and their shared TypeScript interfaces (`src/types/docs.ts`).
3. **Multi-Format File Parser & Test Suite Scaffolding:**
   - Rapidly drafted the Markdown-to-HTML / HTML-to-Markdown converters and the 5 end-to-end integration test cases in `tests/api.test.mjs`.

---

## 3. AI-Generated Output I Changed or Rejected (Human Engineering Judgment)

1. **Rejected Naive React `dangerouslySetInnerHTML` Binding on `contentEditable`:**
   - *Initial AI Pattern:* Binding `dangerouslySetInnerHTML={{ __html: draftHtml }}` directly to React state on every `onInput` keystroke.
   - *Why I Rejected It:* In React, re-rendering `innerHTML` on every keystroke resets the browser's `Selection` and jumps the user's cursor back to the beginning of the document, making rich-text editing unusable.
   - *My Fix:* Implemented an imperative DOM ref synchronization pattern (`editorRef` + `loadedDocIdRef` + `syncEditorDom`) that only writes to `innerHTML` when switching documents, restoring a version snapshot, importing a file, or inserting AI output—keeping typing smooth and cursor-stable while still auto-saving in the background.
2. **Rejected Unprotected Client-Only Read-Only Checks:**
   - *Initial AI Pattern:* Disabling the toolbar buttons in the UI when a user is a `Viewer`, without enforcing role checks on the backend `PATCH` and `DELETE` endpoints.
   - *Why I Changed It:* UI-only locks are not real access control. I added strict server-side role resolution (`resolveAccessRole` in `src/lib/db.ts`) that rejects unauthorized reads (`403`), blocks `Viewer` edits (`403`), and restricts document deletion and share management exclusively to the `Owner` (`403`).
3. **Rejected Local-Disk-Only Attachment Storage:**
   - *Initial AI Pattern:* Writing uploaded files to a local `./uploads` directory on disk.
   - *Why I Changed It:* Serverless deployments (such as Vercel) have ephemeral/read-only filesystems where local upload folders disappear across invocations. I changed the data model to store extracted text and base64-encoded attachment payloads (bounded to `2 MB`) directly inside the persisted database state.
4. **Hardened `.docx` Upload Parsing:**
   - Rather than requiring heavy external binary dependencies or rejecting `.docx` files, I implemented a zero-dependency ZIP local header parser using Node's native `node:zlib` (`inflateRawSync`) to extract `word/document.xml` `<w:p>` and `<w:t>` nodes into structured HTML paragraphs.

---

## 4. How I Verified Correctness, UX Quality, and Reliability

1. **Strict Static Type Checking (`npx tsc --noEmit` & `npm run build`):**
   - Verified zero TypeScript or Next.js production build errors across all server routes and client components.
2. **Automated End-to-End API Integration Tests (`npm test`):**
   - Wrote 5 comprehensive integration tests in `tests/api.test.mjs` exercising Next.js `NextRequest` handlers against an isolated temporary store:
     - Seeded user & document separation (`Owned` vs. `Shared`).
     - Document creation, rich-text HTML persistence, renaming, and version snapshot restoration.
     - Role-based access control (`Owner` vs. `Editor` vs. `Viewer` `HTTP 403` enforcement and share revocation).
     - Multi-mode file upload (`.md` and `.txt` conversion + `.exe` extension rejection).
     - Collaborative comments, custom user creation, and AI structured output with simulated `HTTP 429` rate-limit fallback.
3. **Interactive Browser & Multi-Persona UX Verification (Caught & Fixed 2 Real Bugs):**
   - **Bug 1 Caught via `npm test`:** Initial seeded comment timestamps used `11:30:00Z` on the same calendar date as the test run (`10:22:00Z` UTC), causing newly posted comments to sort behind a seeded comment. Fixed by shifting seed timestamps to the prior day (`2026-11-09`).
   - **Bug 2 Caught via Headless Chrome Screenshot Inspection:** On initial page load, `activeDoc` started as `null` (rendering the empty-state placeholder), so `editorRef.current` was `null` at the exact synchronous moment `fetchDocumentDetail` returned. Added a post-mount `useEffect` watching `activeDoc` so `editorRef.current.innerHTML` hydrates immediately once the `contentEditable` DOM node mounts.
   - Tested switching live between **Wesam Nasr (Owner)**, **Sara Chen (Editor)**, and **Alex Rivera (Viewer)** to confirm immediate UI state updates, read-only banner locks, file uploads, and Markdown/PDF exports.
