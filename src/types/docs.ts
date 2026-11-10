export type ShareRole = 'editor' | 'viewer';
export type AccessRole = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  avatarColor: string;
}

export interface DocumentShare {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ShareRole;
  createdAt: string;
}

export interface DocumentAttachment {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  base64Data: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  content: string;
  resolved: boolean;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  contentHtml: string;
  savedBy: string;
  savedByName: string;
  summary: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  contentHtml: string;
  plainText: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummaryItem {
  id: string;
  title: string;
  excerpt: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  accessRole: AccessRole;
  shareCount: number;
  attachmentCount: number;
  commentCount: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  contentHtml: string;
  plainText: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  accessRole: AccessRole;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  shares: DocumentShare[];
  attachments: DocumentAttachment[];
  comments: DocumentComment[];
  versions: DocumentVersion[];
}
