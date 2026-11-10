import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

// Isolate tests to a temporary store file so local data/ajaia-store.json is never mutated
const tmpStoreFile = path.join(os.tmpdir(), `ajaia-test-store-${ process.pid }-${ Date.now() }.json`);
process.env.AJAIA_STORE_PATH = tmpStoreFile;
delete process.env.DATABASE_URL;

const { GET: getHealth } = await import('../src/app/api/health/route.ts');
const { GET: getUsers, POST: postUser } = await import('../src/app/api/users/route.ts');
const { GET: getDocs, POST: postDoc } = await import('../src/app/api/documents/route.ts');
const {
  GET: getDocById,
  PATCH: patchDocById,
  DELETE: deleteDocById,
} = await import('../src/app/api/documents/[id]/route.ts');
const {
  POST: postShare,
  DELETE: deleteShare,
} = await import('../src/app/api/documents/[id]/shares/route.ts');
const { POST: postUpload } = await import('../src/app/api/documents/upload/route.ts');
const {
  POST: postComment,
  PATCH: patchComment,
} = await import('../src/app/api/documents/[id]/comments/route.ts');
const { POST: postRestoreVersion } = await import('../src/app/api/documents/[id]/versions/route.ts');
const { POST: postAiAssist } = await import('../src/app/api/ai/assist/route.ts');
const {
  generateStructuredAI,
  parseStructuredJson,
  resolveModelForProvider,
} = await import('../src/lib/llm-client.ts');

test.after(() => {
  if (fs.existsSync(tmpStoreFile)) {
    fs.unlinkSync(tmpStoreFile);
  }
});

test('1. Health check & seeded users / documents initialize with distinct Owned vs Shared lists', async () => {
  const healthRes = await getHealth();
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.ok, true);
  assert.equal(health.userCount, 3);
  assert.equal(health.documentCount, 3);

  const usersRes = await getUsers();
  const { users } = await usersRes.json();
  assert.equal(users.length, 3);

  // Check Wesam's view: 1 Owned doc, 2 Shared docs (1 Editor, 1 Viewer)
  const wesamDocsReq = new NextRequest('http://localhost:3000/api/documents?userId=user-wesam');
  const wesamDocsRes = await getDocs(wesamDocsReq);
  assert.equal(wesamDocsRes.status, 200);
  const wesamDocs = await wesamDocsRes.json();
  assert.equal(wesamDocs.owned.length, 1);
  assert.equal(wesamDocs.owned[0].accessRole, 'owner');
  assert.equal(wesamDocs.shared.length, 2);
  const roles = wesamDocs.shared.map((d) => d.accessRole).sort();
  assert.deepEqual(roles, ['editor', 'viewer']);
});

test('2. Document creation, rich-text formatting persistence, rename, and version snapshot restore work end-to-end', async () => {
  // Create new rich-text document owned by Wesam
  const createReq = new NextRequest('http://localhost:3000/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Initial Product Draft',
      contentHtml: '<h1>Heading One</h1><p>This is <strong>bold</strong>, <em>italic</em>, and <u>underlined</u> text.</p><ul><li>Bullet 1</li></ul>',
      ownerId: 'user-wesam',
    }),
  });
  const createRes = await postDoc(createReq);
  assert.equal(createRes.status, 201);
  const { document: created } = await createRes.json();
  assert.ok(created.id);
  assert.equal(created.title, 'Initial Product Draft');
  assert.match(created.contentHtml, /<strong>bold<\/strong>/);
  assert.equal(created.versions.length, 1);
  const initialVersionId = created.versions[0].id;

  // Rename and update rich-text content with snapshot
  const patchReq = new NextRequest(`http://localhost:3000/api/documents/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-wesam',
      title: 'Renamed Product Specification v2',
      contentHtml: '<h2>Updated Section</h2><ol><li>Numbered item</li></ol>',
      createVersionSnapshot: true,
      versionSummary: 'Updated to v2',
    }),
  });
  const patchRes = await patchDocById(patchReq, { params: { id: created.id } });
  assert.equal(patchRes.status, 200);
  const { document: updated } = await patchRes.json();
  assert.equal(updated.title, 'Renamed Product Specification v2');
  assert.match(updated.contentHtml, /<ol><li>Numbered item<\/li><\/ol>/);
  assert.equal(updated.versions.length, 2);

  // Restore initial version snapshot
  const restoreReq = new NextRequest(`http://localhost:3000/api/documents/${created.id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-wesam',
      versionId: initialVersionId,
    }),
  });
  const restoreRes = await postRestoreVersion(restoreReq, { params: { id: created.id } });
  assert.equal(restoreRes.status, 200);
  const { document: restored } = await restoreRes.json();
  assert.equal(restored.title, 'Initial Product Draft');
  assert.match(restored.contentHtml, /<strong>bold<\/strong>/);
});

test('3. Sharing & Role-Based Access Control: Owner vs Editor vs Viewer enforcement', async () => {
  // Create a private document owned by Wesam
  const createReq = new NextRequest('http://localhost:3000/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Confidential Architecture Doc',
      contentHtml: '<p>Initial confidential draft.</p>',
      ownerId: 'user-wesam',
    }),
  });
  const { document: doc } = await (await postDoc(createReq)).json();

  // Before sharing, Sara cannot view it (HTTP 403)
  const unauthGetReq = new NextRequest(
    `http://localhost:3000/api/documents/${doc.id}?userId=user-sara`
  );
  const unauthGetRes = await getDocById(unauthGetReq, { params: { id: doc.id } });
  assert.equal(unauthGetRes.status, 403);

  // Wesam shares with Alex as Viewer (Read-Only) and Sara as Editor
  const shareAlexReq = new NextRequest(`http://localhost:3000/api/documents/${doc.id}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorUserId: 'user-wesam',
      targetEmailOrUserId: 'user-alex',
      role: 'viewer',
    }),
  });
  assert.equal((await postShare(shareAlexReq, { params: { id: doc.id } })).status, 200);

  const shareSaraReq = new NextRequest(`http://localhost:3000/api/documents/${doc.id}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorUserId: 'user-wesam',
      targetEmailOrUserId: 'user-sara',
      role: 'editor',
    }),
  });
  assert.equal((await postShare(shareSaraReq, { params: { id: doc.id } })).status, 200);

  // Alex (Viewer) can GET the document but CANNOT edit (HTTP 403)
  const alexGetReq = new NextRequest(
    `http://localhost:3000/api/documents/${doc.id}?userId=user-alex`
  );
  const alexGetRes = await getDocById(alexGetReq, { params: { id: doc.id } });
  assert.equal(alexGetRes.status, 200);
  const { document: alexDoc } = await alexGetRes.json();
  assert.equal(alexDoc.accessRole, 'viewer');

  const alexEditReq = new NextRequest(`http://localhost:3000/api/documents/${doc.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-alex',
      contentHtml: '<p>Unauthorized viewer edit attempt</p>',
    }),
  });
  const alexEditRes = await patchDocById(alexEditReq, { params: { id: doc.id } });
  assert.equal(alexEditRes.status, 403);

  // Sara (Editor) CAN edit the document content (HTTP 200), but CANNOT delete the document (HTTP 403)
  const saraEditReq = new NextRequest(`http://localhost:3000/api/documents/${doc.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-sara',
      contentHtml: '<p>Collaboratively edited by Sara Chen.</p>',
    }),
  });
  const saraEditRes = await patchDocById(saraEditReq, { params: { id: doc.id } });
  assert.equal(saraEditRes.status, 200);

  const saraDeleteReq = new NextRequest(
    `http://localhost:3000/api/documents/${doc.id}?userId=user-sara`,
    { method: 'DELETE' }
  );
  const saraDeleteRes = await deleteDocById(saraDeleteReq, { params: { id: doc.id } });
  assert.equal(saraDeleteRes.status, 403);

  // Revoke Alex's viewer access
  const revokeReq = new NextRequest(
    `http://localhost:3000/api/documents/${doc.id}/shares?actorUserId=user-wesam&targetUserId=user-alex`,
    { method: 'DELETE' }
  );
  const revokeRes = await deleteShare(revokeReq, { params: { id: doc.id } });
  assert.equal(revokeRes.status, 200);
});

test('4. File upload workflow converts .md / .txt / .docx into editable documents and supports attachments', async () => {
  // Upload a .md file as a new editable document
  const mdUploadReq = new NextRequest('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'sprint-release-notes.md',
      mimeType: 'text/markdown',
      contentText: '# Sprint 14 Release Notes\n\nWe shipped **rich-text editing** and *role-based sharing*.\n\n- Completed SQLite/Postgres persistence\n- Added file upload ingestion',
      mode: 'new-document',
      userId: 'user-wesam',
    }),
  });
  const mdUploadRes = await postUpload(mdUploadReq);
  assert.equal(mdUploadRes.status, 201);
  const { document: uploadedDoc } = await mdUploadRes.json();
  assert.equal(uploadedDoc.title, 'Sprint 14 Release Notes');
  assert.match(uploadedDoc.contentHtml, /<h1>Sprint 14 Release Notes<\/h1>/);
  assert.match(uploadedDoc.contentHtml, /<strong>rich-text editing<\/strong>/);
  assert.equal(uploadedDoc.attachments.length, 1);
  assert.equal(uploadedDoc.attachments[0].fileName, 'sprint-release-notes.md');

  // Import a .txt file into the existing document
  const importReq = new NextRequest('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'appendix-metrics.txt',
      mimeType: 'text/plain',
      contentText: 'Latency remained under 95ms p99 across all endpoints.',
      mode: 'import-into-doc',
      userId: 'user-wesam',
      documentId: uploadedDoc.id,
    }),
  });
  const importRes = await postUpload(importReq);
  assert.equal(importRes.status, 200);
  const { document: afterImport } = await importRes.json();
  assert.match(afterImport.contentHtml, /Latency remained under 95ms p99/);
  assert.equal(afterImport.attachments.length, 2);

  // Reject unsupported file extensions (.exe) with 400
  const badExtReq = new NextRequest('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'malicious.exe',
      contentText: 'binary',
      mode: 'new-document',
      userId: 'user-wesam',
    }),
  });
  const badExtRes = await postUpload(badExtReq);
  assert.equal(badExtRes.status, 400);
});

test('5. Comments, custom user creation, and AI writing assistant with fallback resilience work cleanly', async () => {
  // Create a new collaborator user via POST /api/users
  const userReq = new NextRequest('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jordan Lee',
      email: 'jordan@ajaia.ai',
      roleTitle: 'Staff Reviewer',
    }),
  });
  const userRes = await postUser(userReq);
  assert.equal(userRes.status, 201);
  const { user: jordan } = await userRes.json();
  assert.equal(jordan.email, 'jordan@ajaia.ai');

  // Add & resolve a comment on doc-roadmap
  const commentReq = new NextRequest('http://localhost:3000/api/documents/doc-roadmap/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-wesam',
      content: 'Ready for final stakeholder review.',
    }),
  });
  const commentRes = await postComment(commentReq, { params: { id: 'doc-roadmap' } });
  assert.equal(commentRes.status, 201);
  const { document: docWithComment } = await commentRes.json();
  const addedComment = docWithComment.comments[0];
  assert.equal(addedComment.content, 'Ready for final stakeholder review.');

  const resolveReq = new NextRequest('http://localhost:3000/api/documents/doc-roadmap/comments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-wesam',
      commentId: addedComment.id,
    }),
  });
  const resolveRes = await patchComment(resolveReq, { params: { id: 'doc-roadmap' } });
  assert.equal(resolveRes.status, 200);

  // AI Assistant endpoint returns structured summary, actions, and suggestedHtml
  const aiReq = new NextRequest('http://localhost:3000/api/ai/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'summarize',
      title: 'Ajaia Q4 Roadmap',
      content: '<p>Ship collaborative rich-text editor with file upload and sharing.</p>',
    }),
  });
  const aiRes = await postAiAssist(aiReq);
  assert.equal(aiRes.status, 200);
  const aiPayload = await aiRes.json();
  assert.equal(typeof aiPayload.data?.summary, 'string');
  assert.ok(Array.isArray(aiPayload.data?.actions));
  assert.equal(typeof aiPayload.data?.suggestedHtml, 'string');

  // Verify LLM client Markdown fence stripping & 429 fallback
  const parsed = parseStructuredJson('```json\n{"summary":"Clean","actions":["One"],"suggestedHtml":"<p>Clean</p>"}\n```');
  assert.equal(parsed.summary, 'Clean');
  assert.equal(resolveModelForProvider('openai', 'gpt-4o-mini'), 'gpt-4o-mini');

  const fallbackResult = await generateStructuredAI({
    systemPrompt: 'Return JSON',
    userPrompt: 'Simulated 429 check',
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    fallbackFn: (txt) => ({
      summary: `Fallback: ${txt}`,
      actions: ['Retry'],
      suggestedHtml: '<p>Fallback</p>',
    }),
  });
  assert.equal(fallbackResult.provider, 'deterministic-fallback');
});
