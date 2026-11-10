import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Pool as PgPool } from 'pg';
import {
  AccessRole,
  DocumentAttachment,
  DocumentComment,
  DocumentDetail,
  DocumentRecord,
  DocumentShare,
  DocumentSummaryItem,
  DocumentVersion,
  ShareRole,
  User,
} from '@/types/docs';
import { countWords, sanitizeRichHtml, stripHtmlToPlainText } from '@/lib/file-parser';

interface StoreState {
  users: User[];
  documents: DocumentRecord[];
  shares: DocumentShare[];
  attachments: DocumentAttachment[];
  comments: DocumentComment[];
  versions: DocumentVersion[];
}

const SEED_TIME_1 = '2026-11-09T09:00:00.000Z';
const SEED_TIME_2 = '2026-11-09T10:15:00.000Z';
const SEED_TIME_3 = '2026-11-09T11:30:00.000Z';

export function buildInitialSeedState(): StoreState {
  const users: User[] = [
    {
      id: 'user-wesam',
      name: 'Wesam Nasr',
      email: 'wesam@ajaia.ai',
      roleTitle: 'AI-Native Full Stack Engineer',
      avatarColor: '#2563eb',
    },
    {
      id: 'user-sara',
      name: 'Sara Chen',
      email: 'sara.chen@ajaia.ai',
      roleTitle: 'Product Lead',
      avatarColor: '#059669',
    },
    {
      id: 'user-alex',
      name: 'Alex Rivera',
      email: 'alex.rivera@ajaia.ai',
      roleTitle: 'Security & QA Reviewer',
      avatarColor: '#d97706',
    },
  ];

  const doc1Html = [
    '<h1>Ajaia Q4 AI Product Strategy &amp; Workspace Roadmap</h1>',
    '<p><strong>GitHub Repository:</strong> <code>https://github.com/wesamnasr/ajaia-assessment</code> | <strong>Author:</strong> Wesam Nasr (<code>wesamnasr999@gmail.com</code>)</p>',
    '<p>This living specification outlines the <strong>Ajaia Collaborative Docs</strong> initiative—designed to help distributed engineering and product teams draft, review, and ship specifications with <em>zero friction</em> and built-in <u>AI workflow assistance</u>.</p>',
    '<h2>1. Core Product Pillars</h2>',
    '<ul>',
    '<li><strong>Rich-Text Authoring:</strong> Clean headings, bold/italic/underline formatting, blockquotes, and structured lists that persist across sessions.</li>',
    '<li><strong>Multi-Mode File Ingestion:</strong> Upload <code>.md</code>, <code>.txt</code>, <code>.docx</code>, or <code>.csv</code> files as new documents, inline draft imports, or downloadable reference attachments.</li>',
    '<li><strong>Explicit Access Control:</strong> Granular document ownership with <strong>Editor</strong> and <strong>Viewer (Read-Only)</strong> sharing permissions enforced on both UI and API layers.</li>',
    '</ul>',
    '<h2>2. Q4 Delivery Milestones</h2>',
    '<ol>',
    '<li>Ship v1 collaborative document workspace with persistent storage and role-based sharing.</li>',
    '<li>Integrate multi-provider AI writing assistant with deterministic fallback resilience.</li>',
    '<li>Enable one-click version snapshots and Markdown / PDF export for stakeholder sign-off.</li>',
    '</ol>',
    '<blockquote>Product Principle: Prioritize deep, reliable execution in core workflows over shallow feature bloat.</blockquote>',
  ].join('\n');

  const doc2Html = [
    '<h1>Collaborative Editor Engineering Spec &amp; Security Posture</h1>',
    '<p>Authored by <strong>Sara Chen</strong> and shared with <strong>Wesam Nasr</strong> as an <u>Editor</u> so both product and engineering can iterate on technical tradeoffs together.</p>',
    '<h2>Architecture Highlights</h2>',
    '<ul>',
    '<li><strong>Dual-Storage Adapter:</strong> Connects to Cloud Postgres when <code>DATABASE_URL</code> is configured, with automatic fallback to a transactional local store so reviewers can run the app in one command.</li>',
    '<li><strong>Server-Side Permission Guards:</strong> Every mutation endpoint verifies whether the active user is the <em>Owner</em> or an authorized <em>Editor</em> before modifying state.</li>',
    '<li><strong>HTML Sanitization:</strong> Strips executable scripts and inline event handlers while preserving semantic formatting tags.</li>',
    '</ul>',
  ].join('\n');

  const doc3Html = [
    '<h1>Customer Onboarding &amp; Compliance Audit Checklist</h1>',
    '<p>This compliance record is owned by <strong>Alex Rivera</strong> and shared with <strong>Wesam Nasr</strong> in <u>Viewer (Read-Only)</u> mode to demonstrate strict permission boundaries.</p>',
    '<h2>Verification Checklist</h2>',
    '<ol>',
    '<li>Verify that <strong>Viewer</strong> accounts can read, export, and download attachments but cannot modify document content or rename the file.</li>',
    '<li>Confirm that switching to <strong>Alex Rivera</strong> (Owner) or <strong>Sara Chen</strong> (Editor) unlocks the rich-text formatting toolbar immediately.</li>',
    '<li>Validate automated integration test coverage across CRUD, sharing, and upload endpoints.</li>',
    '</ol>',
  ].join('\n');

  const documents: DocumentRecord[] = [
    {
      id: 'doc-roadmap',
      title: 'Ajaia Q4 AI Product Strategy & Workspace Roadmap',
      contentHtml: doc1Html,
      plainText: stripHtmlToPlainText(doc1Html),
      ownerId: 'user-wesam',
      createdAt: SEED_TIME_1,
      updatedAt: SEED_TIME_3,
    },
    {
      id: 'doc-architecture',
      title: 'Collaborative Editor Engineering Spec & Security Posture',
      contentHtml: doc2Html,
      plainText: stripHtmlToPlainText(doc2Html),
      ownerId: 'user-sara',
      createdAt: SEED_TIME_1,
      updatedAt: SEED_TIME_2,
    },
    {
      id: 'doc-compliance',
      title: 'Customer Onboarding & Compliance Audit Checklist',
      contentHtml: doc3Html,
      plainText: stripHtmlToPlainText(doc3Html),
      ownerId: 'user-alex',
      createdAt: SEED_TIME_1,
      updatedAt: SEED_TIME_1,
    },
  ];

  const shares: DocumentShare[] = [
    {
      id: 'share-1',
      documentId: 'doc-roadmap',
      userId: 'user-sara',
      userName: 'Sara Chen',
      userEmail: 'sara.chen@ajaia.ai',
      role: 'editor',
      createdAt: SEED_TIME_1,
    },
    {
      id: 'share-3',
      documentId: 'doc-architecture',
      userId: 'user-wesam',
      userName: 'Wesam Nasr',
      userEmail: 'wesam@ajaia.ai',
      role: 'editor',
      createdAt: SEED_TIME_2,
    },
    {
      id: 'share-5',
      documentId: 'doc-compliance',
      userId: 'user-wesam',
      userName: 'Wesam Nasr',
      userEmail: 'wesam@ajaia.ai',
      role: 'viewer',
      createdAt: SEED_TIME_1,
    },
  ];

  const sampleAttachmentText =
    '# Q4 Key Performance Indicators\n- Document Save Latency: < 120ms\n- AI Structured Summary Accuracy: 99%\n- Zero Cross-Tenant Permission Leaks';

  const attachments: DocumentAttachment[] = [
    {
      id: 'att-seed-1',
      documentId: 'doc-roadmap',
      fileName: 'q4-kpi-targets.md',
      mimeType: 'text/markdown',
      sizeBytes: Buffer.byteLength(sampleAttachmentText, 'utf8'),
      extractedText: sampleAttachmentText,
      base64Data: Buffer.from(sampleAttachmentText, 'utf8').toString('base64'),
      uploadedBy: 'user-wesam',
      uploadedByName: 'Wesam Nasr',
      createdAt: SEED_TIME_2,
    },
  ];

  const comments: DocumentComment[] = [
    {
      id: 'comment-seed-1',
      documentId: 'doc-roadmap',
      authorId: 'user-sara',
      authorName: 'Sara Chen',
      content: 'Love the clarity on the three file upload workflows. Let us keep the 2MB limit explicit in the upload modal.',
      resolved: false,
      createdAt: SEED_TIME_2,
    },
    {
      id: 'comment-seed-2',
      documentId: 'doc-roadmap',
      authorId: 'user-alex',
      authorName: 'Alex Rivera',
      content: 'Confirmed that Viewer role blocks PATCH / DELETE requests with HTTP 403.',
      resolved: true,
      createdAt: SEED_TIME_3,
    },
  ];

  const versions: DocumentVersion[] = [
    {
      id: 'ver-seed-1',
      documentId: 'doc-roadmap',
      title: 'Ajaia Q4 AI Product Strategy (Initial Outline)',
      contentHtml: '<h1>Ajaia Q4 AI Product Strategy</h1><p>Initial outline created during sprint planning.</p>',
      savedBy: 'user-wesam',
      savedByName: 'Wesam Nasr',
      summary: 'Initial document creation',
      createdAt: SEED_TIME_1,
    },
    {
      id: 'ver-seed-2',
      documentId: 'doc-roadmap',
      title: 'Ajaia Q4 AI Product Strategy & Workspace Roadmap',
      contentHtml: doc1Html,
      savedBy: 'user-wesam',
      savedByName: 'Wesam Nasr',
      summary: 'Added Q4 delivery milestones and product pillars',
      createdAt: SEED_TIME_3,
    },
  ];

  return { users, documents, shares, attachments, comments, versions };
}

function resolveLocalStoreFilePath(): string {
  const customPath = (process.env.AJAIA_STORE_PATH || '').trim();
  if (customPath) return path.resolve(customPath);

  const dataDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const probeFile = path.join(dataDir, '.write-probe');
    fs.writeFileSync(probeFile, 'ok', 'utf8');
    fs.unlinkSync(probeFile);
    return path.join(dataDir, 'ajaia-store.json');
  } catch {
    return path.join(os.tmpdir(), 'ajaia-store.json');
  }
}

let memoryCache: StoreState | null = null;
let lastStorePath: string | null = null;

function readLocalStore(): StoreState {
  const filePath = resolveLocalStoreFilePath();
  if (lastStorePath !== filePath) {
    memoryCache = null;
    lastStorePath = filePath;
  }

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreState;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.documents)) {
        memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Recover with seed state if corrupted
    }
  }

  if (memoryCache) return memoryCache;

  const initial = buildInitialSeedState();
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(state: StoreState): void {
  const filePath = resolveLocalStoreFilePath();
  memoryCache = state;
  lastStorePath = filePath;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Keep in-memory state if disk write fails in restricted container
  }
}

// Optional Cloud Postgres Pool (when DATABASE_URL is configured)
let pgPool: PgPool | null = null;
let pgInitialized = false;

async function getPostgresStore(): Promise<PgPool | null> {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) return null;

  try {
    if (!pgPool) {
      const { Pool } = eval('require')('pg') as typeof import('pg');
      pgPool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 5000,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      });
    }
    if (!pgInitialized) {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS ajaia_kv_store (
          store_key TEXT PRIMARY KEY,
          state_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      const existing = await pgPool.query(`SELECT state_json FROM ajaia_kv_store WHERE store_key = 'primary'`);
      if (existing.rowCount === 0) {
        const seed = buildInitialSeedState();
        await pgPool.query(
          `INSERT INTO ajaia_kv_store (store_key, state_json, updated_at) VALUES ('primary', $1::jsonb, NOW()) ON CONFLICT (store_key) DO NOTHING`,
          [JSON.stringify(seed)]
        );
      }
      pgInitialized = true;
    }
    return pgPool;
  } catch {
    return null;
  }
}

async function loadState(): Promise<{ state: StoreState; mode: 'cloud-postgres' | 'local-persistence' }> {
  const pool = await getPostgresStore();
  if (pool) {
    try {
      const res = await pool.query(`SELECT state_json FROM ajaia_kv_store WHERE store_key = 'primary'`);
      if (res.rows[0]?.state_json) {
        return { state: res.rows[0].state_json as StoreState, mode: 'cloud-postgres' };
      }
    } catch {
      // Fallback to local store
    }
  }
  return { state: readLocalStore(), mode: 'local-persistence' };
}

async function saveState(state: StoreState): Promise<void> {
  writeLocalStore(state);
  const pool = await getPostgresStore();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO ajaia_kv_store (store_key, state_json, updated_at) VALUES ('primary', $1::jsonb, NOW())
         ON CONFLICT (store_key) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()`,
        [JSON.stringify(state)]
      );
    } catch {
      // Local store already updated
    }
  }
}

export async function getStorageHealth(): Promise<{ mode: 'cloud-postgres' | 'local-persistence'; userCount: number; documentCount: number }> {
  const { state, mode } = await loadState();
  return {
    mode,
    userCount: state.users.length,
    documentCount: state.documents.length,
  };
}

export async function listUsers(): Promise<User[]> {
  const { state } = await loadState();
  return state.users;
}

export async function createOrGetUser(input: {
  id?: string;
  name: string;
  email: string;
  roleTitle?: string;
}): Promise<User> {
  const { state } = await loadState();
  const cleanEmail = String(input.email ?? '').trim().toLowerCase();
  const cleanName = String(input.name ?? '').trim();
  const requestedId = String(input.id ?? '').trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw Object.assign(new Error('A valid email address is required'), { statusCode: 400 });
  }

  const existing = state.users.find(
    (u) => u.email.toLowerCase() === cleanEmail || (requestedId && u.id === requestedId)
  );
  if (existing) {
    if (cleanName && existing.name !== cleanName) {
      existing.name = cleanName;
      await saveState(state);
    }
    return existing;
  }

  const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
  const newUser: User = {
    id: requestedId || `user-${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName || cleanEmail.split('@')[0],
    email: cleanEmail,
    roleTitle: String(input.roleTitle || 'Team Collaborator').trim(),
    avatarColor: palette[state.users.length % palette.length],
  };

  state.users.push(newUser);
  await saveState(state);
  return newUser;
}

function resolveAccessRole(state: StoreState, doc: DocumentRecord, userId: string): AccessRole | null {
  if (doc.ownerId === userId) return 'owner';
  const share = state.shares.find((s) => s.documentId === doc.id && s.userId === userId);
  if (!share) return null;
  return share.role;
}

function toSummaryItem(state: StoreState, doc: DocumentRecord, accessRole: AccessRole): DocumentSummaryItem {
  const owner = state.users.find((u) => u.id === doc.ownerId);
  const shareCount = state.shares.filter((s) => s.documentId === doc.id).length;
  const attachmentCount = state.attachments.filter((a) => a.documentId === doc.id).length;
  const commentCount = state.comments.filter((c) => c.documentId === doc.id && !c.resolved).length;
  const plain = doc.plainText || stripHtmlToPlainText(doc.contentHtml);

  return {
    id: doc.id,
    title: doc.title,
    excerpt: plain.slice(0, 140) || 'Empty document',
    ownerId: doc.ownerId,
    ownerName: owner?.name || 'Unknown Owner',
    ownerEmail: owner?.email || '',
    accessRole,
    shareCount,
    attachmentCount,
    commentCount,
    wordCount: countWords(plain),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listDocumentsForUser(userId: string): Promise<{
  owned: DocumentSummaryItem[];
  shared: DocumentSummaryItem[];
}> {
  const { state } = await loadState();
  const owned: DocumentSummaryItem[] = [];
  const shared: DocumentSummaryItem[] = [];

  const sortedDocs = [...state.documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const doc of sortedDocs) {
    const role = resolveAccessRole(state, doc, userId);
    if (!role) continue;
    const item = toSummaryItem(state, doc, role);
    if (role === 'owner') {
      owned.push(item);
    } else {
      shared.push(item);
    }
  }

  return { owned, shared };
}

export async function getDocumentDetailForUser(documentId: string, userId: string): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, userId);
  if (!role) {
    throw Object.assign(
      new Error('Access denied: You do not have permission to view this document'),
      { statusCode: 403 }
    );
  }

  const owner = state.users.find((u) => u.id === doc.ownerId);
  const plain = doc.plainText || stripHtmlToPlainText(doc.contentHtml);

  return {
    id: doc.id,
    title: doc.title,
    contentHtml: doc.contentHtml,
    plainText: plain,
    ownerId: doc.ownerId,
    ownerName: owner?.name || 'Unknown Owner',
    ownerEmail: owner?.email || '',
    accessRole: role,
    wordCount: countWords(plain),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    shares: state.shares.filter((s) => s.documentId === doc.id),
    attachments: state.attachments.filter((a) => a.documentId === doc.id),
    comments: state.comments
      .filter((c) => c.documentId === doc.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    versions: state.versions
      .filter((v) => v.documentId === doc.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function createDocument(input: {
  title: string;
  contentHtml?: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  versionSummary?: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const title = String(input.title ?? '').trim();
  if (!title) {
    throw Object.assign(new Error('Document title is required'), { statusCode: 400 });
  }

  const cleanOwnerId = String(input.ownerId ?? '').trim();
  if (!cleanOwnerId) {
    throw Object.assign(new Error('Valid owner userId is required'), { statusCode: 400 });
  }

  let owner = state.users.find((u) => u.id === cleanOwnerId);
  if (!owner) {
    const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
    owner = {
      id: cleanOwnerId,
      name: String(input.ownerName || 'Workspace Collaborator').trim(),
      email: String(input.ownerEmail || `${cleanOwnerId}@ajaia.ai`).trim().toLowerCase(),
      roleTitle: 'Team Collaborator',
      avatarColor: palette[state.users.length % palette.length],
    };
    state.users.push(owner);
  }

  const now = new Date().toISOString();
  const safeHtml = sanitizeRichHtml(input.contentHtml ?? '<p></p>');
  const plainText = stripHtmlToPlainText(safeHtml);
  const docId = `doc-${crypto.randomUUID().slice(0, 8)}`;

  const newDoc: DocumentRecord = {
    id: docId,
    title,
    contentHtml: safeHtml,
    plainText,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
  };

  state.documents.unshift(newDoc);

  state.versions.unshift({
    id: `ver-${crypto.randomUUID().slice(0, 8)}`,
    documentId: docId,
    title,
    contentHtml: safeHtml,
    savedBy: owner.id,
    savedByName: owner.name,
    summary: input.versionSummary || 'Created document',
    createdAt: now,
  });

  await saveState(state);
  return getDocumentDetailForUser(docId, owner.id);
}

export async function updateDocument(input: {
  documentId: string;
  userId: string;
  title?: string;
  contentHtml?: string;
  createVersionSnapshot?: boolean;
  versionSummary?: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role) {
    throw Object.assign(new Error('Access denied: Document is not shared with this user'), { statusCode: 403 });
  }
  if (role === 'viewer') {
    throw Object.assign(
      new Error('Read-only access: Viewers cannot edit or rename this document'),
      { statusCode: 403 }
    );
  }

  if (input.title !== undefined) {
    const nextTitle = String(input.title).trim();
    if (!nextTitle) {
      throw Object.assign(new Error('Document title cannot be empty'), { statusCode: 400 });
    }
    doc.title = nextTitle;
  }

  if (input.contentHtml !== undefined) {
    doc.contentHtml = sanitizeRichHtml(input.contentHtml);
    doc.plainText = stripHtmlToPlainText(doc.contentHtml);
  }

  const now = new Date().toISOString();
  doc.updatedAt = now;

  if (input.createVersionSnapshot !== false) {
    const actor = state.users.find((u) => u.id === input.userId);
    state.versions.unshift({
      id: `ver-${crypto.randomUUID().slice(0, 8)}`,
      documentId: doc.id,
      title: doc.title,
      contentHtml: doc.contentHtml,
      savedBy: input.userId,
      savedByName: actor?.name || input.userId,
      summary: input.versionSummary || 'Saved document changes',
      createdAt: now,
    });
  }

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}

export async function deleteDocument(documentId: string, userId: string): Promise<{ ok: boolean; id: string }> {
  const { state } = await loadState();
  const idx = state.documents.findIndex((d) => d.id === documentId);
  if (idx === -1) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const doc = state.documents[idx];
  if (doc.ownerId !== userId) {
    throw Object.assign(new Error('Only the document owner can delete this document'), { statusCode: 403 });
  }

  state.documents.splice(idx, 1);
  state.shares = state.shares.filter((s) => s.documentId !== documentId);
  state.attachments = state.attachments.filter((a) => a.documentId !== documentId);
  state.comments = state.comments.filter((c) => c.documentId !== documentId);
  state.versions = state.versions.filter((v) => v.documentId !== documentId);

  await saveState(state);
  return { ok: true, id: documentId };
}

export async function shareDocumentWithUser(input: {
  documentId: string;
  actorUserId: string;
  targetEmailOrUserId: string;
  targetName?: string;
  role: ShareRole;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  if (doc.ownerId !== input.actorUserId) {
    throw Object.assign(new Error('Only the document owner can manage sharing permissions'), { statusCode: 403 });
  }

  if (input.role !== 'editor' && input.role !== 'viewer') {
    throw Object.assign(new Error('Share role must be either "editor" or "viewer"'), { statusCode: 400 });
  }

  const targetKey = String(input.targetEmailOrUserId ?? '').trim();
  if (!targetKey) {
    throw Object.assign(new Error('Target userId or email is required'), { statusCode: 400 });
  }

  let targetUser = state.users.find(
    (u) => u.id === targetKey || u.email.toLowerCase() === targetKey.toLowerCase()
  );

  if (!targetUser) {
    if (!targetKey.includes('@')) {
      throw Object.assign(new Error('Target user not found. Enter a valid email to invite a new user.'), {
        statusCode: 404,
      });
    }
    const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
    targetUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      name: String(input.targetName || targetKey.split('@')[0]).trim(),
      email: targetKey.toLowerCase(),
      roleTitle: 'Invited Collaborator',
      avatarColor: palette[state.users.length % palette.length],
    };
    state.users.push(targetUser);
  }

  if (targetUser.id === doc.ownerId) {
    throw Object.assign(new Error('Document owner already has full access'), { statusCode: 400 });
  }

  const existingShare = state.shares.find(
    (s) => s.documentId === doc.id && s.userId === targetUser!.id
  );

  const now = new Date().toISOString();
  if (existingShare) {
    existingShare.role = input.role;
    existingShare.userName = targetUser.name;
    existingShare.userEmail = targetUser.email;
  } else {
    state.shares.push({
      id: `share-${crypto.randomUUID().slice(0, 8)}`,
      documentId: doc.id,
      userId: targetUser.id,
      userName: targetUser.name,
      userEmail: targetUser.email,
      role: input.role,
      createdAt: now,
    });
  }

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.actorUserId);
}

export async function removeDocumentShare(input: {
  documentId: string;
  actorUserId: string;
  shareIdOrUserId: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  if (doc.ownerId !== input.actorUserId) {
    throw Object.assign(new Error('Only the document owner can revoke sharing access'), { statusCode: 403 });
  }

  state.shares = state.shares.filter(
    (s) =>
      !(
        s.documentId === doc.id &&
        (s.id === input.shareIdOrUserId || s.userId === input.shareIdOrUserId)
      )
  );

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.actorUserId);
}

export async function addAttachmentToDocument(input: {
  documentId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  base64Data: string;
  appendHtmlToDocument?: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role || role === 'viewer') {
    throw Object.assign(new Error('Only owners and editors can upload files to this document'), {
      statusCode: 403,
    });
  }

  const actor = state.users.find((u) => u.id === input.userId);
  const now = new Date().toISOString();

  state.attachments.push({
    id: `att-${crypto.randomUUID().slice(0, 8)}`,
    documentId: doc.id,
    fileName: input.fileName,
    mimeType: input.mimeType || 'text/plain',
    sizeBytes: input.sizeBytes,
    extractedText: input.extractedText,
    base64Data: input.base64Data,
    uploadedBy: input.userId,
    uploadedByName: actor?.name || input.userId,
    createdAt: now,
  });

  if (input.appendHtmlToDocument) {
    doc.contentHtml = sanitizeRichHtml(`${doc.contentHtml}\n<hr/>\n${input.appendHtmlToDocument}`);
    doc.plainText = stripHtmlToPlainText(doc.contentHtml);
    doc.updatedAt = now;
    state.versions.unshift({
      id: `ver-${crypto.randomUUID().slice(0, 8)}`,
      documentId: doc.id,
      title: doc.title,
      contentHtml: doc.contentHtml,
      savedBy: input.userId,
      savedByName: actor?.name || input.userId,
      summary: `Imported content from ${input.fileName}`,
      createdAt: now,
    });
  } else {
    doc.updatedAt = now;
  }

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}

export async function removeAttachmentFromDocument(input: {
  documentId: string;
  userId: string;
  attachmentId: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role || role === 'viewer') {
    throw Object.assign(new Error('Only owners and editors can remove attachments from this document'), {
      statusCode: 403,
    });
  }

  state.attachments = state.attachments.filter(
    (a) => !(a.documentId === doc.id && a.id === input.attachmentId)
  );
  doc.updatedAt = new Date().toISOString();

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}

export async function addDocumentComment(input: {
  documentId: string;
  userId: string;
  content: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const text = String(input.content ?? '').trim();
  if (!text) {
    throw Object.assign(new Error('Comment text cannot be empty'), { statusCode: 400 });
  }

  const actor = state.users.find((u) => u.id === input.userId);
  state.comments.unshift({
    id: `comment-${crypto.randomUUID().slice(0, 8)}`,
    documentId: doc.id,
    authorId: input.userId,
    authorName: actor?.name || input.userId,
    content: text,
    resolved: false,
    createdAt: new Date().toISOString(),
  });

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}

export async function toggleCommentResolved(input: {
  documentId: string;
  userId: string;
  commentId: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const comment = state.comments.find(
    (c) => c.id === input.commentId && c.documentId === doc.id
  );
  if (!comment) {
    throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  }

  comment.resolved = !comment.resolved;
  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}

export async function restoreDocumentVersion(input: {
  documentId: string;
  userId: string;
  versionId: string;
}): Promise<DocumentDetail> {
  const { state } = await loadState();
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  }

  const role = resolveAccessRole(state, doc, input.userId);
  if (!role || role === 'viewer') {
    throw Object.assign(new Error('Only owners and editors can restore document versions'), {
      statusCode: 403,
    });
  }

  const version = state.versions.find(
    (v) => v.id === input.versionId && v.documentId === doc.id
  );
  if (!version) {
    throw Object.assign(new Error('Version snapshot not found'), { statusCode: 404 });
  }

  const now = new Date().toISOString();
  doc.title = version.title;
  doc.contentHtml = version.contentHtml;
  doc.plainText = stripHtmlToPlainText(version.contentHtml);
  doc.updatedAt = now;

  const actor = state.users.find((u) => u.id === input.userId);
  state.versions.unshift({
    id: `ver-${crypto.randomUUID().slice(0, 8)}`,
    documentId: doc.id,
    title: doc.title,
    contentHtml: doc.contentHtml,
    savedBy: input.userId,
    savedByName: actor?.name || input.userId,
    summary: `Restored snapshot from ${new Date(version.createdAt).toLocaleTimeString()}`,
    createdAt: now,
  });

  await saveState(state);
  return getDocumentDetailForUser(doc.id, input.userId);
}
