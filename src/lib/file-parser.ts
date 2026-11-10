export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx', '.html', '.htm', '.csv', '.json'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB limit

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtmlToPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function countWords(text: string): number {
  const cleaned = String(text ?? '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function sanitizeRichHtml(rawHtml: string): string {
  return String(rawHtml ?? '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function formatInlineMarkdown(line: string): string {
  let out = escapeHtml(line);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<u>$1</u>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/_(.+?)_/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

export function markdownToHtml(md: string): string {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    if (trimmed.startsWith('### ')) {
      closeLists();
      htmlParts.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeLists();
      htmlParts.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeLists();
      htmlParts.push(`<h1>${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('> ')) {
      closeLists();
      htmlParts.push(`<blockquote>${formatInlineMarkdown(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        htmlParts.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push('<ul>');
        inUl = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        htmlParts.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push('<ol>');
        inOl = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  return htmlParts.join('\n') || '<p></p>';
}

export function htmlToMarkdown(html: string): string {
  let out = String(html ?? '');
  out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${stripHtmlToPlainText(c)}\n\n`);
  out = out.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${stripHtmlToPlainText(c)}\n\n`);
  out = out.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${stripHtmlToPlainText(c)}\n\n`);
  out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => `> ${stripHtmlToPlainText(c)}\n\n`);
  out = out.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  out = out.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  out = out.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  out = out.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  out = out.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '__$1__');
  out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listBody) => {
    const items = String(listBody).match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    return items.map((item) => `- ${stripHtmlToPlainText(item)}`).join('\n') + '\n\n';
  });
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listBody) => {
    const items = String(listBody).match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    return items.map((item, idx) => `${idx + 1}. ${stripHtmlToPlainText(item)}`).join('\n') + '\n\n';
  });
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${stripHtmlToPlainText(c)}\n\n`);
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<[^>]+>/g, '');
  return out
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractDocxParagraphsFromBuffer(buffer: Buffer): string[] {
  // Check for PK\x03\x04 ZIP header
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    let offset = 0;
    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const entryName = buffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataStart = offset + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) break;

      if (entryName === 'word/document.xml') {
        const rawSlice = buffer.subarray(dataStart, dataEnd);
        const nodeZlib = eval('require')('zlib') as typeof import('zlib');
        const xmlBuffer =
          compression === 8
            ? nodeZlib.inflateRawSync(rawSlice)
            : compression === 0
              ? rawSlice
              : Buffer.alloc(0);
        const xml = xmlBuffer.toString('utf8');
        const paragraphs: string[] = [];
        const pMatches = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
        for (const pXml of pMatches) {
          const tMatches = pXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
          const line = tMatches
            .map((t) => t.replace(/<[^>]+>/g, ''))
            .join('')
            .trim();
          if (line) paragraphs.push(line);
        }
        if (paragraphs.length > 0) return paragraphs;
      }
      offset = dataEnd;
    }
  }

  // Fallback for plain-text or XML-based .docx test payloads
  const rawUtf8 = buffer.toString('utf8');
  if (rawUtf8.includes('<w:t')) {
    const tMatches = rawUtf8.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
    const text = tMatches.map((t) => t.replace(/<[^>]+>/g, '')).join(' ').trim();
    if (text) return [text];
  }
  return rawUtf8
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function parseUploadedFileToRichContent(fileName: string, buffer: Buffer): {
  suggestedTitle: string;
  contentHtml: string;
  plainText: string;
} {
  const cleanName = String(fileName || 'Untitled Document').trim();
  const ext = (cleanName.match(/\.[^.]+$/)?.[0] || '.txt').toLowerCase();
  const baseTitle = cleanName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported Document';

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file extension "${ext}". Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds maximum allowed size of 2 MB');
  }

  if (ext === '.docx') {
    const paragraphs = extractDocxParagraphsFromBuffer(buffer);
    const html =
      paragraphs.length > 0
        ? paragraphs.map((p, idx) => (idx === 0 && p.length < 90 ? `<h2>${escapeHtml(p)}</h2>` : `<p>${escapeHtml(p)}</p>`)).join('\n')
        : '<p>(Empty DOCX document)</p>';
    return {
      suggestedTitle: baseTitle,
      contentHtml: html,
      plainText: paragraphs.join('\n\n'),
    };
  }

  const rawText = buffer.toString('utf8').replace(/^\uFEFF/, '');

  if (ext === '.md' || ext === '.markdown') {
    const html = markdownToHtml(rawText);
    const firstH1 = rawText.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return {
      suggestedTitle: firstH1 || baseTitle,
      contentHtml: html,
      plainText: stripHtmlToPlainText(html),
    };
  }

  if (ext === '.html' || ext === '.htm') {
    const safeHtml = sanitizeRichHtml(rawText);
    return {
      suggestedTitle: baseTitle,
      contentHtml: safeHtml || '<p></p>',
      plainText: stripHtmlToPlainText(safeHtml),
    };
  }

  if (ext === '.csv') {
    const rows = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);
    const listItems = rows.map((r) => `<li><code>${escapeHtml(r)}</code></li>`).join('\n');
    const html = `<h3>Imported CSV Data (${escapeHtml(cleanName)})</h3>\n<ul>\n${listItems}\n</ul>`;
    return {
      suggestedTitle: baseTitle,
      contentHtml: html,
      plainText: rows.join('\n'),
    };
  }

  // .txt and .json
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const html =
    lines.length > 0
      ? lines.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`).join('\n')
      : '<p></p>';

  return {
    suggestedTitle: baseTitle,
    contentHtml: html,
    plainText: rawText.trim(),
  };
}
