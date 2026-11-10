'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Check,
  Clock,
  Download,
  Eye,
  FilePlus,
  FileText,
  FileUp,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  History,
  Italic,
  List,
  ListOrdered,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Printer,
  Quote,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Underline,
  Undo2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DocumentAttachment,
  DocumentDetail,
  DocumentSummaryItem,
  ShareRole,
  User,
} from '@/types/docs';
import { countWords, htmlToMarkdown, stripHtmlToPlainText } from '@/lib/file-parser';

type RightTab = 'ai' | 'comments' | 'history';
type UploadMode = 'new-document' | 'import-into-doc' | 'attach-only';

interface HealthStatus {
  ok: boolean;
  storageMode: string;
  aiProviderReady: boolean;
}

export default function AjaiaDocsWorkspace() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>('user-wesam');
  const [ownedDocs, setOwnedDocs] = useState<DocumentSummaryItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentSummaryItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);

  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftHtml, setDraftHtml] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatusText, setSaveStatusText] = useState<string>('All changes saved');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rightTab, setRightTab] = useState<RightTab>('ai');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(false);
  const [leftWidth, setLeftWidth] = useState<number>(310);
  const [rightWidth, setRightWidth] = useState<number>(340);
  const resizingSideRef = useRef<'left' | 'right' | null>(null);
  const [banner, setBanner] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Modals
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showNewUserModal, setShowNewUserModal] = useState<boolean>(false);

  // Share form state
  const [shareTarget, setShareTarget] = useState<string>('');
  const [shareTargetName, setShareTargetName] = useState<string>('');
  const [shareRole, setShareRole] = useState<ShareRole>('editor');
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Upload form state
  const [uploadMode, setUploadMode] = useState<UploadMode>('new-document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customUploadTitle, setCustomUploadTitle] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // New user form state
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRoleTitle, setNewUserRoleTitle] = useState<string>('');

  // Comments & AI state
  const [commentInput, setCommentInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiOutput, setAiOutput] = useState<{
    provider: string;
    summary: string;
    actions: string[];
    suggestedHtml: string;
  } | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const loadedDocIdRef = useRef<string>('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );

  const canEdit = activeDoc?.accessRole === 'owner' || activeDoc?.accessRole === 'editor';
  const isOwner = activeDoc?.accessRole === 'owner';

  const showNotification = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      setBanner({ text, type });
    },
    []
  );

  const syncEditorDom = useCallback((html: string) => {
    setDraftHtml(html);
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, []);

  const fetchDocumentDetail = useCallback(
    async (docId: string, userId: string, forceDomSync = true) => {
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(docId)}?userId=${encodeURIComponent(userId)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load document');
        }
        const detail: DocumentDetail = data.document;
        setActiveDoc(detail);
        setDraftTitle(detail.title);
        setIsDirty(false);
        setSaveStatusText('All changes saved');
        if (forceDomSync || loadedDocIdRef.current !== detail.id) {
          loadedDocIdRef.current = detail.id;
          syncEditorDom(detail.contentHtml);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load document';
        showNotification(msg, 'error');
      }
    },
    [showNotification, syncEditorDom]
  );

  const refreshWorkspace = useCallback(
    async (userId: string, preferredDocId?: string) => {
      try {
        const [healthRes, usersRes, docsRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }),
          fetch('/api/users', { cache: 'no-store' }),
          fetch(`/api/documents?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' }),
        ]);

        if (healthRes.ok) {
          setHealth(await healthRes.json());
        }
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(Array.isArray(uData.users) ? uData.users : []);
        }
        if (docsRes.ok) {
          const dData = await docsRes.json();
          const owned: DocumentSummaryItem[] = Array.isArray(dData.owned) ? dData.owned : [];
          const shared: DocumentSummaryItem[] = Array.isArray(dData.shared) ? dData.shared : [];
          setOwnedDocs(owned);
          setSharedDocs(shared);

          const allVisible = [...owned, ...shared];
          const targetId =
            preferredDocId && allVisible.some((d) => d.id === preferredDocId)
              ? preferredDocId
              : allVisible[0]?.id;

          if (targetId) {
            await fetchDocumentDetail(targetId, userId, true);
          } else {
            setActiveDoc(null);
            setDraftTitle('');
            syncEditorDom('');
          }
        }
      } catch {
        showNotification('Failed to initialize workspace data', 'error');
      }
    },
    [fetchDocumentDetail, showNotification, syncEditorDom]
  );

  useEffect(() => {
    refreshWorkspace(activeUserId);
  }, [activeUserId, refreshWorkspace]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('ajaia_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    try {
      window.localStorage.setItem('ajaia_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingSideRef.current) return;
      if (resizingSideRef.current === 'left') {
        const nextWidth = Math.max(220, Math.min(480, e.clientX));
        setLeftWidth(nextWidth);
      } else if (resizingSideRef.current === 'right') {
        const nextWidth = Math.max(240, Math.min(500, window.innerWidth - e.clientX));
        setRightWidth(nextWidth);
      }
    };
    const handleMouseUp = () => {
      if (resizingSideRef.current) {
        resizingSideRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Ensure editor DOM is populated once the contentEditable node mounts after activeDoc transitions from null
  useEffect(() => {
    if (activeDoc && editorRef.current) {
      if (loadedDocIdRef.current !== activeDoc.id || !editorRef.current.innerHTML.trim()) {
        loadedDocIdRef.current = activeDoc.id;
        editorRef.current.innerHTML = activeDoc.contentHtml;
        setDraftHtml(activeDoc.contentHtml);
      }
    }
  }, [activeDoc]);

  const handleSaveDocument = useCallback(
    async (createSnapshot = false, customSummary?: string) => {
      if (!activeDoc || !canEdit) return;
      const trimmedTitle = draftTitle.trim();
      if (!trimmedTitle) {
        showNotification('Document title cannot be empty', 'error');
        return;
      }

      const currentHtml = editorRef.current ? editorRef.current.innerHTML : draftHtml;
      setIsSaving(true);
      setSaveStatusText('Saving changes...');

      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeUserId,
            title: trimmedTitle,
            contentHtml: currentHtml,
            createVersionSnapshot: createSnapshot,
            versionSummary:
              customSummary ||
              (createSnapshot ? `Manual snapshot by ${activeUser?.name || activeUserId}` : undefined),
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to save document');
        }

        const updated: DocumentDetail = payload.document;
        setActiveDoc(updated);
        setIsDirty(false);
        setSaveStatusText(`Saved at ${new Date(updated.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);

        // Refresh sidebar list counts/titles silently
        const listRes = await fetch(`/api/documents?userId=${encodeURIComponent(activeUserId)}`, {
          cache: 'no-store',
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          setOwnedDocs(Array.isArray(listData.owned) ? listData.owned : []);
          setSharedDocs(Array.isArray(listData.shared) ? listData.shared : []);
        }
        if (createSnapshot) {
          showNotification('Document saved and version snapshot recorded.', 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed';
        setSaveStatusText('Save failed');
        showNotification(msg, 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [activeDoc, canEdit, draftTitle, draftHtml, activeUserId, activeUser?.name, showNotification]
  );

  // Debounced auto-save when user edits title or rich text
  useEffect(() => {
    if (!isDirty || !canEdit || !activeDoc) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatusText('Unsaved edits...');
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDocument(false);
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [draftTitle, draftHtml, isDirty, canEdit, activeDoc, handleSaveDocument]);

  const applyFormat = (command: string, value?: string) => {
    if (!canEdit || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setDraftHtml(editorRef.current.innerHTML);
    setIsDirty(true);
  };

  const handleCreateNewDocument = async () => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Collaborative Spec',
          contentHtml:
            '<h1>Untitled Collaborative Spec</h1><p>Start typing here, apply rich formatting from the toolbar above, or import a file...</p>',
          ownerId: activeUserId,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not create document');
      const created: DocumentDetail = payload.document;
      await refreshWorkspace(activeUserId, created.id);
      showNotification(`Created "${created.title}"`, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to create document', 'error');
    }
  };

  const handleDeleteDocument = async () => {
    if (!activeDoc || !isOwner) return;
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(activeDoc.id)}?userId=${encodeURIComponent(activeUserId)}`,
        { method: 'DELETE' }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to delete document');
      showNotification(`Deleted "${activeDoc.title}"`, 'info');
      await refreshWorkspace(activeUserId);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc) return;
    setIsSharing(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorUserId: activeUserId,
          targetEmailOrUserId: shareTarget.trim(),
          targetName: shareTargetName.trim() || undefined,
          role: shareRole,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to update sharing');
      setActiveDoc(payload.document);
      setShareTarget('');
      setShareTargetName('');
      await refreshWorkspace(activeUserId, activeDoc.id);
      showNotification(`Shared document with ${shareTarget} as ${shareRole.toUpperCase()}`, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Share failed', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleQuickShare = async (targetUserId: string, role: ShareRole) => {
    if (!activeDoc) return;
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorUserId: activeUserId,
          targetEmailOrUserId: targetUserId,
          role,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to share');
      setActiveDoc(payload.document);
      await refreshWorkspace(activeUserId, activeDoc.id);
      showNotification('Updated collaborator access permissions.', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Could not update share', 'error');
    }
  };

  const handleRevokeShare = async (shareIdOrUserId: string) => {
    if (!activeDoc) return;
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(activeDoc.id)}/shares?actorUserId=${encodeURIComponent(
          activeUserId
        )}&shareId=${encodeURIComponent(shareIdOrUserId)}`,
        { method: 'DELETE' }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to revoke access');
      setActiveDoc(payload.document);
      await refreshWorkspace(activeUserId, activeDoc.id);
      showNotification('Collaborator access revoked.', 'info');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Revoke failed', 'error');
    }
  };

  const handleMakeDocumentPrivate = async () => {
    if (!activeDoc || activeDoc.shares.length === 0) return;
    try {
      let latestDoc = activeDoc;
      for (const share of activeDoc.shares) {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(activeDoc.id)}/shares?actorUserId=${encodeURIComponent(
            activeUserId
          )}&shareId=${encodeURIComponent(share.id)}`,
          { method: 'DELETE' }
        );
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Failed to revoke share');
        latestDoc = payload.document;
      }
      setActiveDoc(latestDoc);
      await refreshWorkspace(activeUserId, activeDoc.id);
      showNotification(`"${activeDoc.title}" is now Private (Only You).`, 'info');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to make document private', 'error');
    }
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showNotification('Please choose a file (.txt, .md, .docx, .html, .csv, .json)', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', uploadMode);
      formData.append('userId', activeUserId);
      if (activeDoc?.id) {
        formData.append('documentId', activeDoc.id);
      }
      if (customUploadTitle.trim()) {
        formData.append('title', customUploadTitle.trim());
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'File upload failed');

      const resultingDoc: DocumentDetail = payload.document;
      setShowUploadModal(false);
      setSelectedFile(null);
      setCustomUploadTitle('');
      await refreshWorkspace(activeUserId, resultingDoc.id);
      syncEditorDom(resultingDoc.contentHtml);
      showNotification(
        uploadMode === 'new-document'
          ? `Created new editable document "${resultingDoc.title}" from ${selectedFile.name}`
          : uploadMode === 'import-into-doc'
            ? `Imported content from ${selectedFile.name} into "${resultingDoc.title}"`
            : `Attached ${selectedFile.name} to "${resultingDoc.title}"`,
        'success'
      );
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !commentInput.trim()) return;
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          content: commentInput.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to add comment');
      setActiveDoc(payload.document);
      setCommentInput('');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Comment error', 'error');
    }
  };

  const handleToggleComment = async (commentId: string) => {
    if (!activeDoc) return;
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId, commentId }),
      });
      const payload = await res.json();
      if (res.ok) setActiveDoc(payload.document);
    } catch {
      // Ignore transient toggle error
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!activeDoc || !canEdit) return;
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId, versionId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not restore version');
      const restored: DocumentDetail = payload.document;
      setActiveDoc(restored);
      setDraftTitle(restored.title);
      syncEditorDom(restored.contentHtml);
      setIsDirty(false);
      showNotification('Restored document to selected version snapshot.', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  };

  const handleRunAiAssistant = async (
    action: 'summarize' | 'action-items' | 'polish' | 'expand'
  ) => {
    if (!activeDoc) return;
    setAiLoading(true);
    try {
      const currentHtml = editorRef.current ? editorRef.current.innerHTML : draftHtml;
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: draftTitle || activeDoc.title,
          content: currentHtml,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'AI Assistant request failed');
      setAiOutput({
        provider: payload.provider || 'ai',
        summary: payload.data?.summary || '',
        actions: Array.isArray(payload.data?.actions) ? payload.data.actions : [],
        suggestedHtml: payload.data?.suggestedHtml || '',
      });
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'AI request failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleInsertAiIntoDocument = async () => {
    if (!activeDoc || !canEdit || !aiOutput?.suggestedHtml) return;
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : draftHtml;
    const combined = `${currentHtml}\n<hr/>\n${aiOutput.suggestedHtml}`;
    syncEditorDom(combined);
    setIsDirty(true);
    showNotification('Inserted AI-generated section into document.', 'success');
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          roleTitle: newUserRoleTitle.trim() || 'Team Collaborator',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not create user');
      const createdUser: User = payload.user;
      setShowNewUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRoleTitle('');
      setActiveUserId(createdUser.id);
      showNotification(`Switched to account: ${createdUser.name} (${createdUser.email})`, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to create user', 'error');
    }
  };

  const handleDownloadAttachment = (att: DocumentAttachment) => {
    const byteCharacters = atob(att.base64Data || '');
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: att.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocument = (format: 'md' | 'txt' | 'pdf') => {
    if (!activeDoc) return;
    if (format === 'pdf') {
      window.print();
      return;
    }
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : draftHtml;
    const content =
      format === 'md'
        ? `# ${draftTitle || activeDoc.title}\n\n${htmlToMarkdown(currentHtml)}`
        : `${draftTitle || activeDoc.title}\n${'='.repeat(40)}\n\n${stripHtmlToPlainText(currentHtml)}`;
    const blob = new Blob([content], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeSlug = (draftTitle || activeDoc.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${safeSlug || 'document'}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredOwned = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ownedDocs;
    return ownedDocs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.excerpt.toLowerCase().includes(q)
    );
  }, [ownedDocs, searchQuery]);

  const filteredShared = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sharedDocs;
    return sharedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.excerpt.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q)
    );
  }, [sharedDocs, searchQuery]);

  const livePlainText = useMemo(() => stripHtmlToPlainText(draftHtml), [draftHtml]);
  const liveWordCount = useMemo(() => countWords(livePlainText), [livePlainText]);

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-150 ${
        theme === 'light' ? 'theme-light bg-slate-50 text-slate-900' : 'theme-dark bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Global Header Bar */}
      <header className="no-print border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & System Status */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm shadow-blue-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Ajaia Docs</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  AI-Native Collaborative Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {health
                  ? `Storage: ${health.storageMode === 'cloud-postgres' ? 'Cloud Postgres' : 'Persistent Local Store'} • AI: ${health.aiProviderReady ? 'Live LLM Ready' : 'Deterministic Fallback'}`
                  : 'Connecting to workspace engine...'}
              </p>
            </div>
          </div>

          {/* Instant User Switcher Dropdown (Seeded Accounts + Custom Login) */}
          <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
            <label htmlFor="active-user-select" className="text-xs text-slate-400 hidden sm:inline">
              Active User:
            </label>
            <div className="flex items-center gap-2">
              {activeUser && (
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeUser.avatarColor }}
                />
              )}
              <select
                id="active-user-select"
                aria-label="Select Active User Account"
                value={activeUserId}
                onChange={(e) => setActiveUserId(e.target.value)}
                className="bg-slate-900 text-slate-100 text-xs font-medium border border-slate-700 rounded-md px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.roleTitle}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewUserModal(true)}
                className="text-xs px-2 py-1 rounded-md text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 flex items-center gap-1 shrink-0"
                title="Add or switch to another user account"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden md:inline">+ User</span>
              </button>
            </div>
          </div>

          {/* Top Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle Light or Dark Theme"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-1.5 transition"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-blue-400" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-1.5 transition"
            >
              <FileUp className="h-3.5 w-3.5 text-blue-400" />
              <span>Upload / Import File</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              disabled={!activeDoc}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition shadow-sm"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share ({activeDoc?.shares.length ?? 0})</span>
            </button>

            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <button
                type="button"
                onClick={() => handleExportDocument('md')}
                disabled={!activeDoc}
                className="text-xs px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 flex items-center gap-1 transition"
                title="Export as Markdown (.md)"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                <span>.MD</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportDocument('pdf')}
                disabled={!activeDoc}
                className="text-xs px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 border-l border-slate-800 flex items-center gap-1 transition"
                title="Print or Save as PDF"
              >
                <Printer className="h-3.5 w-3.5 text-purple-400" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Banner */}
      {banner && (
        <div
          className={`no-print px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
            banner.type === 'error'
              ? 'bg-red-950/80 border-red-800 text-red-200'
              : banner.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-blue-950/80 border-blue-800 text-blue-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Resizable & Collapsible 3-Column Workspace */}
      <div className="flex-1 max-w-[1680px] w-full mx-auto flex flex-col lg:flex-row items-stretch">
        {/* LEFT SIDEBAR: Owned vs. Shared Documents (Collapsible + Resizable) */}
        {leftCollapsed ? (
          <aside className="no-print border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60 p-2 flex lg:flex-col items-center justify-between lg:justify-start gap-3 shrink-0 lg:w-12">
            <button
              type="button"
              onClick={() => setLeftCollapsed(false)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
              title="Expand Documents Sidebar"
              aria-label="Expand Documents Sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCreateNewDocument}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
              title="New Document"
            >
              <FilePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('new-document');
                setShowUploadModal(true);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Upload / Import File"
            >
              <FileUp className="h-4 w-4 text-blue-400" />
            </button>
            <div
              className="hidden lg:flex flex-col items-center gap-1 mt-2 pt-2 border-t border-slate-800 text-[10px] font-bold text-slate-400"
              title={`${filteredOwned.length} Owned • ${filteredShared.length} Shared`}
            >
              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                {filteredOwned.length}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                {filteredShared.length}
              </span>
            </div>
          </aside>
        ) : (
          <aside
            style={{ width: undefined }}
            className="no-print border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/40 p-3.5 flex flex-col gap-3.5 shrink-0 relative lg:w-[var(--left-panel-w)]"
            ref={(el) => {
              if (el) el.style.setProperty('--left-panel-w', `${leftWidth}px`);
            }}
          >
            {/* Sidebar Control Header (Resize + Collapse) */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
                Workspace Docs
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeftWidth((w) => (w >= 380 ? 260 : w <= 270 ? 310 : 410))}
                  className="hidden lg:flex p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  title="Toggle Sidebar Width (Compact / Standard / Wide)"
                  aria-label="Toggle Left Sidebar Width"
                >
                  {leftWidth >= 380 ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLeftCollapsed(true)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  title="Collapse Documents Sidebar"
                  aria-label="Collapse Documents Sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateNewDocument}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <FilePlus className="h-4 w-4" />
                <span>New Document</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode('new-document');
                  setShowUploadModal(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-2.5 rounded-lg border border-slate-700 flex items-center gap-1 transition"
                title="Create document from uploaded file (.txt, .md, .docx)"
              >
                <FileUp className="h-4 w-4 text-blue-400" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter owned or shared docs..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Active Identity Card */}
            {activeUser && (
              <div className="rounded-lg bg-slate-950/90 border border-slate-800/90 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{activeUser.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {activeUser.roleTitle}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">{activeUser.email}</div>
              </div>
            )}

            {/* Owned Documents List */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  My Owned Documents
                </span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-300 font-semibold">
                  {filteredOwned.length}
                </span>
              </div>

              {filteredOwned.length === 0 ? (
                <p className="text-xs text-slate-500 px-2 py-2 italic">
                  No owned documents match. Click &ldquo;New Document&rdquo; above.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredOwned.map((doc) => {
                    const selected = activeDoc?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => fetchDocumentDetail(doc.id, activeUserId, true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fetchDocumentDetail(doc.id, activeUserId, true);
                          }
                        }}
                        className={`text-left p-2.5 rounded-lg border transition cursor-pointer ${
                          selected
                            ? 'bg-blue-600/15 border-blue-500/60 text-white'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs line-clamp-1">{doc.title}</span>
                          <span
                            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                              doc.shareCount > 0
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700'
                            }`}
                          >
                            {doc.shareCount > 0 ? `Shared (${doc.shareCount})` : 'Private'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{doc.excerpt}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                          <span>{doc.wordCount} words</span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetchDocumentDetail(doc.id, activeUserId, true);
                              setShowShareModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 font-medium transition"
                            title="Manage sharing for this specific document"
                          >
                            <Share2 className="h-2.5 w-2.5" />
                            {doc.shareCount > 0 ? 'Manage Share' : 'Share File'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shared With Me List */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Shared With Me
                </span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold">
                  {filteredShared.length}
                </span>
              </div>

              {filteredShared.length === 0 ? (
                <p className="text-xs text-slate-500 px-2 py-2 italic">
                  No documents shared with {activeUser?.name || 'this user'} yet.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredShared.map((doc) => {
                    const selected = activeDoc?.id === doc.id;
                    const isEditorRole = doc.accessRole === 'editor';
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => fetchDocumentDetail(doc.id, activeUserId, true)}
                        className={`text-left p-2.5 rounded-lg border transition ${
                          selected
                            ? 'bg-emerald-600/15 border-emerald-500/60 text-white'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs line-clamp-1">{doc.title}</span>
                          <span
                            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                              isEditorRole
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isEditorRole ? 'Can Edit' : 'View Only'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{doc.excerpt}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                          <span>Owner: {doc.ownerName}</span>
                          <span>{doc.wordCount} words</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drag Handle to Resize Left Sidebar */}
            <div
              onMouseDown={() => {
                resizingSideRef.current = 'left';
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              title="Drag to resize left sidebar"
              className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/40 transition-colors"
            />
          </aside>
        )}

        {/* CENTER COLUMN: Rich-Text Document Editor */}
        <main className="flex-1 min-w-0 p-4 md:p-6 flex flex-col gap-4 bg-slate-950">
          {!activeDoc ? (
            <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/40 p-12 flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-slate-600 mb-3" />
              <h2 className="text-lg font-semibold text-slate-200">No Document Selected</h2>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                Select a document from the left sidebar, create a new collaborative document, or upload a{' '}
                <code>.md</code>, <code>.txt</code>, or <code>.docx</code> file.
              </p>
              <button
                type="button"
                onClick={handleCreateNewDocument}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Create First Document
              </button>
            </div>
          ) : (
            <>
              {/* Read-Only Alert Banner if Viewer */}
              {!canEdit && (
                <div className="no-print rounded-lg bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Read-Only Mode (Viewer):</strong> Owned by{' '}
                      <strong>{activeDoc.ownerName}</strong>. You can read, comment, download attachments, or export, but editing is locked.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveUserId(activeDoc.ownerId)}
                    className="shrink-0 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-medium border border-amber-500/40"
                  >
                    Switch to Owner ({activeDoc.ownerName})
                  </button>
                </div>
              )}

              {/* Document Title & Metadata Header */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 print-only-sheet">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        activeDoc.accessRole === 'owner'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : activeDoc.accessRole === 'editor'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {activeDoc.accessRole === 'owner'
                        ? 'Owner Access'
                        : activeDoc.accessRole === 'editor'
                          ? 'Shared — Editor Access'
                          : 'Shared — Viewer (Read-Only)'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Owner: <strong className="text-slate-200">{activeDoc.ownerName}</strong> ({activeDoc.ownerEmail})
                    </span>
                  </div>

                  <div className="no-print flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {saveStatusText}
                    </span>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleSaveDocument(true)}
                        disabled={isSaving}
                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition"
                        title="Save document and record a version history snapshot"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Snapshot'}</span>
                      </button>
                    )}

                    {isOwner && (
                      <button
                        type="button"
                        onClick={handleDeleteDocument}
                        className="text-xs px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 flex items-center gap-1 transition"
                        title="Delete Document (Owner Only)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable Document Title Input */}
                <div>
                  <input
                    type="text"
                    value={draftTitle}
                    disabled={!canEdit}
                    onChange={(e) => {
                      setDraftTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Document Title..."
                    aria-label="Document Title"
                    className="w-full bg-transparent text-xl md:text-2xl font-bold text-white border-b border-transparent focus:border-blue-500 focus:outline-none pb-1 disabled:opacity-80"
                  />
                </div>

                {/* Rich-Text Formatting Toolbar */}
                <div className="no-print flex flex-wrap items-center gap-1 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('bold')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('italic')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('underline')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="h-4 w-4" />
                  </button>

                  <span className="h-4 w-px bg-slate-800 mx-1" />

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('formatBlock', 'H1')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40 flex items-center gap-0.5 text-xs font-semibold"
                    title="Heading 1"
                  >
                    <Heading1 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('formatBlock', 'H2')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40 flex items-center gap-0.5 text-xs font-semibold"
                    title="Heading 2"
                  >
                    <Heading2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('formatBlock', 'H3')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40 flex items-center gap-0.5 text-xs font-semibold"
                    title="Heading 3"
                  >
                    <Heading3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('formatBlock', 'P')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40 text-xs"
                    title="Normal Paragraph"
                  >
                    <Type className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('formatBlock', 'BLOCKQUOTE')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Callout Quote"
                  >
                    <Quote className="h-4 w-4" />
                  </button>

                  <span className="h-4 w-px bg-slate-800 mx-1" />

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('insertUnorderedList')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Bulleted List"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('insertOrderedList')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Numbered List"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>

                  <span className="h-4 w-px bg-slate-800 mx-1" />

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('undo')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('redo')}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 disabled:opacity-40"
                    title="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => applyFormat('removeFormat')}
                    className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 text-[11px]"
                    title="Clear Inline Formatting"
                  >
                    Clear Format
                  </button>

                  <div className="ml-auto text-[11px] text-slate-400">
                    {liveWordCount} words • {livePlainText.length} chars
                  </div>
                </div>
              </div>

              {/* Rich-Text Paper Canvas */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 shadow-xl print-only-sheet">
                <div
                  ref={editorRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  onInput={(e) => {
                    setDraftHtml((e.target as HTMLDivElement).innerHTML);
                    setIsDirty(true);
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                      e.preventDefault();
                      handleSaveDocument(true);
                    }
                  }}
                  aria-label="Rich Text Document Editor"
                  className={`ajaia-editor-canvas ${
                    !canEdit ? 'cursor-not-allowed opacity-90' : ''
                  }`}
                />
              </div>

              {/* Associated Document Attachments Bar */}
              <div className="no-print rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-blue-400" />
                    Associated Files &amp; Attachments ({activeDoc.attachments.length})
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMode('attach-only');
                        setShowUploadModal(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Attach or Import File
                    </button>
                  )}
                </div>

                {activeDoc.attachments.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No files attached to this document yet. Supported upload types: <code>.txt</code>,{' '}
                    <code>.md</code>, <code>.docx</code>, <code>.html</code>, <code>.csv</code>,{' '}
                    <code>.json</code> (up to 2 MB).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDoc.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200 truncate">{att.fileName}</div>
                          <div className="text-[10px] text-slate-500">
                            {(att.sizeBytes / 1024).toFixed(1)} KB • Uploaded by {att.uploadedByName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(att)}
                          className="shrink-0 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                          title="Download Attachment"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* RIGHT SIDEBAR: AI Writing Assistant, Comments, and Version History (Collapsible + Resizable) */}
        {rightCollapsed ? (
          <aside className="no-print border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60 p-2 flex lg:flex-col items-center justify-between lg:justify-start gap-3 shrink-0 lg:w-12">
            <button
              type="button"
              onClick={() => setRightCollapsed(false)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
              title="Expand AI & Collaboration Sidebar"
              aria-label="Expand AI & Collaboration Sidebar"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRightTab('ai');
                setRightCollapsed(false);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
              title="Open AI Copilot"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRightTab('comments');
                setRightCollapsed(false);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
              title="Open Comments"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRightTab('history');
                setRightCollapsed(false);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
              title="Open Version History"
            >
              <History className="h-4 w-4" />
            </button>
          </aside>
        ) : (
          <aside
            className="no-print border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/40 p-3.5 flex flex-col gap-3 shrink-0 relative lg:w-[var(--right-panel-w)]"
            ref={(el) => {
              if (el) el.style.setProperty('--right-panel-w', `${rightWidth}px`);
            }}
          >
            {/* Drag Handle to Resize Right Sidebar */}
            <div
              onMouseDown={() => {
                resizingSideRef.current = 'right';
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              title="Drag to resize right sidebar"
              className="hidden lg:block absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/40 transition-colors"
            />

            {/* Right Sidebar Header (Resize + Collapse) */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Studio &amp; History
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightWidth((w) => (w >= 400 ? 280 : w <= 290 ? 340 : 440))}
                  className="hidden lg:flex p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  title="Toggle Sidebar Width (Compact / Standard / Wide)"
                  aria-label="Toggle Right Sidebar Width"
                >
                  {rightWidth >= 400 ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRightCollapsed(true)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  title="Collapse Studio Sidebar"
                  aria-label="Collapse Studio Sidebar"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setRightTab('ai')}
              className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition ${
                rightTab === 'ai' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Assist</span>
            </button>
            <button
              type="button"
              onClick={() => setRightTab('comments')}
              className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition ${
                rightTab === 'comments'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Comments ({activeDoc?.comments.length ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setRightTab('history')}
              className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition ${
                rightTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Versions ({activeDoc?.versions.length ?? 0})</span>
            </button>
          </div>

          {/* TAB 1: AI Studio */}
          {rightTab === 'ai' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  AI Document Copilot
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Run structured AI workflows on the active document and insert formatted sections directly into your draft.
                </p>

                <div className="grid grid-cols-2 gap-1.5 mt-3">
                  <button
                    type="button"
                    disabled={!activeDoc || aiLoading}
                    onClick={() => handleRunAiAssistant('summarize')}
                    className="text-xs py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left transition disabled:opacity-50"
                  >
                    ✦ Summarize Doc
                  </button>
                  <button
                    type="button"
                    disabled={!activeDoc || aiLoading}
                    onClick={() => handleRunAiAssistant('action-items')}
                    className="text-xs py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left transition disabled:opacity-50"
                  >
                    ✦ Action Items
                  </button>
                  <button
                    type="button"
                    disabled={!activeDoc || aiLoading}
                    onClick={() => handleRunAiAssistant('polish')}
                    className="text-xs py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left transition disabled:opacity-50"
                  >
                    ✦ Polish Tone
                  </button>
                  <button
                    type="button"
                    disabled={!activeDoc || aiLoading}
                    onClick={() => handleRunAiAssistant('expand')}
                    className="text-xs py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-left transition disabled:opacity-50"
                  >
                    ✦ Expand Spec
                  </button>
                </div>
              </div>

              {aiLoading && (
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 text-xs text-blue-300 animate-pulse">
                  Analyzing document and generating structured output...
                </div>
              )}

              {aiOutput && !aiLoading && (
                <div className="rounded-lg bg-slate-950 border border-blue-500/30 p-3 flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-300">
                      AI Output ({aiOutput.provider})
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleInsertAiIntoDocument}
                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium"
                      >
                        + Insert Into Doc
                      </button>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed">{aiOutput.summary}</p>
                  {aiOutput.actions.length > 0 && (
                    <ul className="list-disc pl-4 text-slate-400 space-y-1">
                      {aiOutput.actions.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Collaborative Comments */}
          {rightTab === 'comments' && activeDoc && (
            <div className="flex flex-col gap-3">
              <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={`Comment as ${activeUser?.name || activeUserId}...`}
                  rows={2}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="self-end px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  Post Comment
                </button>
              </form>

              <div className="flex flex-col gap-2">
                {activeDoc.comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-2.5 text-xs ${
                      c.resolved
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{c.authorName}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleComment(c.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        <Check className="h-3 w-3 text-emerald-400" />
                        {c.resolved ? 'Resolved' : 'Resolve'}
                      </button>
                    </div>
                    <p className="text-slate-300 mt-1">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Version History */}
          {rightTab === 'history' && activeDoc && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-slate-400">
                Every manual snapshot, file import, and initial creation is preserved. Owners and Editors can restore any version.
              </p>
              {activeDoc.versions.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{v.savedByName}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(v.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{v.summary}</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRestoreVersion(v.id)}
                      className="self-start mt-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore Version
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </aside>
        )}
      </div>

      {/* MODAL 1: Share Document & Manage Permissions */}
      {showShareModal && activeDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-blue-400" />
                  Share &ldquo;{activeDoc.title}&rdquo;
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Owner: <strong>{activeDoc.ownerName}</strong> ({activeDoc.ownerEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isOwner ? (
              <div className="my-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                Only the document owner (<strong>{activeDoc.ownerName}</strong>) can grant or revoke sharing permissions. Switch to {activeDoc.ownerName} in the top bar to modify access.
              </div>
            ) : (
              <>
                {/* Per-Document Privacy vs Shared Status Banner */}
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">
                      {activeDoc.shares.length === 0
                        ? 'Private Document (Only You)'
                        : `Shared Document (${activeDoc.shares.length} Collaborator${
                            activeDoc.shares.length === 1 ? '' : 's'
                          })`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Sharing applies strictly to this document only. Other files remain unaffected.
                    </div>
                  </div>
                  {activeDoc.shares.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMakeDocumentPrivate}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition"
                    >
                      Make Private (Unshare All)
                    </button>
                  )}
                </div>

                {/* Quick Share with Seeded Team Accounts */}
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Quick Grant to Seeded Team Accounts:
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {users
                      .filter((u) => u.id !== activeDoc.ownerId)
                      .map((u) => {
                        const existing = activeDoc.shares.find((s) => s.userId === u.id);
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
                          >
                            <div>
                              <div className="font-medium text-slate-200">{u.name}</div>
                              <div className="text-[11px] text-slate-500">{u.email}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickShare(u.id, 'editor')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border ${
                                  existing?.role === 'editor'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                Grant Editor
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickShare(u.id, 'viewer')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border ${
                                  existing?.role === 'viewer'
                                    ? 'bg-amber-600 text-white border-amber-500'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                Grant Viewer
                              </button>
                              {existing && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeShare(existing.id)}
                                  className="px-2 py-1 rounded text-[11px] bg-red-500/15 text-red-300 hover:bg-red-500/25"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Invite by Email Form */}
                <form onSubmit={handleShareSubmit} className="mt-4 pt-3 border-t border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Or Share with Any Email Address:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="email"
                      value={shareTarget}
                      onChange={(e) => setShareTarget(e.target.value)}
                      placeholder="reviewer@ajaia.ai"
                      required
                      className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value as ShareRole)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="editor">Editor (Can Edit)</option>
                      <option value="viewer">Viewer (Read-Only)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <input
                      type="text"
                      value={shareTargetName}
                      onChange={(e) => setShareTargetName(e.target.value)}
                      placeholder="Collaborator Name (optional)"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white w-56"
                    />
                    <button
                      type="submit"
                      disabled={isSharing}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
                    >
                      {isSharing ? 'Sharing...' : 'Grant Access'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Current Shared Access List */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Active Shared Collaborators ({activeDoc.shares.length})
              </div>
              {activeDoc.shares.length === 0 ? (
                <p className="text-xs text-slate-500">This document is currently private to the owner.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {activeDoc.shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5"
                    >
                      <span>
                        <strong className="text-slate-200">{s.userName}</strong> ({s.userEmail})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            s.role === 'editor'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {s.role === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRevokeShare(s.id)}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-300 hover:bg-red-500/25 font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: File Upload & Ingestion Workflow */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-blue-400" />
                  Upload File Into Product Workflow
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supported formats: <code>.txt</code>, <code>.md</code>, <code>.docx</code>,{' '}
                  <code>.html</code>, <code>.csv</code>, <code>.json</code> (Max 2 MB)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFileUploadSubmit} className="mt-4 flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  1. Choose Workflow Behavior:
                </label>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      checked={uploadMode === 'new-document'}
                      onChange={() => setUploadMode('new-document')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">
                        Turn File Into a New Editable Document
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Parses headings, lists, and paragraphs from <code>.md</code>, <code>.txt</code>, or{' '}
                        <code>.docx</code> into a new rich-text document.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-950 ${
                      !canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="uploadMode"
                      disabled={!canEdit}
                      checked={uploadMode === 'import-into-doc'}
                      onChange={() => setUploadMode('import-into-doc')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">
                        Import File Content Into Current Draft ({activeDoc?.title || 'None'})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Appends the formatted file contents into the currently open document and attaches the original file.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-950 ${
                      !canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="uploadMode"
                      disabled={!canEdit}
                      checked={uploadMode === 'attach-only'}
                      onChange={() => setUploadMode('attach-only')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">
                        Attach Reference File Only
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Associates the file with the current document for team download without modifying the body text.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  2. Select File (.txt, .md, .docx, .html, .csv, .json):
                </label>
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.docx,.html,.htm,.csv,.json"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 bg-slate-950 border border-slate-800 rounded-lg p-2"
                />
              </div>

              {uploadMode === 'new-document' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Optional Custom Document Title:
                  </label>
                  <input
                    type="text"
                    value={customUploadTitle}
                    onChange={(e) => setCustomUploadTitle(e.target.value)}
                    placeholder="Leave blank to auto-detect title from file..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  {isUploading ? 'Processing File...' : 'Upload & Process'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add / Switch User Account */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-400" />
                Switch or Create Collaborator Account
              </h3>
              <button
                type="button"
                onClick={() => setShowNewUserModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Jordan Lee"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="jordan@ajaia.ai"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Role / Title</label>
                <input
                  type="text"
                  value={newUserRoleTitle}
                  onChange={(e) => setNewUserRoleTitle(e.target.value)}
                  placeholder="Engineering Reviewer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Switch to Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
