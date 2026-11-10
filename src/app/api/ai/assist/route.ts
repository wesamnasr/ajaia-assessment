import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredAI } from '@/lib/llm-client';
import { escapeHtml, stripHtmlToPlainText } from '@/lib/file-parser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'summarize' | 'action-items' | 'polish' | 'expand';
      title?: string;
      content?: string;
    };

    const action = body.action || 'summarize';
    const title = String(body.title || 'Untitled Document').trim();
    const plainContent = stripHtmlToPlainText(String(body.content || '')).trim();

    if (!plainContent && !title) {
      return NextResponse.json(
        { error: 'Document content or title is required for AI assistance' },
        { status: 400 }
      );
    }

    const promptByAction: Record<string, string> = {
      summarize:
        'You are an executive document assistant inside Ajaia Docs. Return JSON: { "summary": string, "actions": string[], "suggestedHtml": string } where suggestedHtml is a well-formatted HTML section (using <h3>, <p>, <ul>, <li>, <strong>) summarizing key takeaways.',
      'action-items':
        'Extract concrete next steps and owners from the document. Return JSON: { "summary": string, "actions": string[], "suggestedHtml": string } where suggestedHtml is an HTML checklist (<ol><li><strong>Action:</strong> ...</li></ol>).',
      polish:
        'Improve clarity, structure, and executive tone of the provided text. Return JSON: { "summary": string, "actions": string[], "suggestedHtml": string } where suggestedHtml contains the polished HTML paragraphs.',
      expand:
        'Expand the document outline into a comprehensive specification section with headings and bullet points. Return JSON: { "summary": string, "actions": string[], "suggestedHtml": string }.',
    };

    const systemPrompt = promptByAction[action] || promptByAction.summarize;
    const userPrompt = `Document Title: ${title}\nRequested Action: ${action}\n\nDocument Body:\n${plainContent.slice(0, 12000)}`;

    const result = await generateStructuredAI({
      systemPrompt,
      userPrompt,
      fallbackFn: () => {
        const snippet = plainContent.slice(0, 220) || title;
        const sentences = plainContent
          .split(/[.!?\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 12)
          .slice(0, 4);

        const bullets =
          sentences.length > 0
            ? sentences
            : [
                `Finalize core deliverables for "${title}"`,
                'Review shared permissions with Editor and Viewer stakeholders',
                'Export final sign-off package to Markdown / PDF',
              ];

        const suggestedHtml = [
          `<h3>AI Assistant Output (${escapeHtml(action.toUpperCase())})</h3>`,
          `<p><strong>Executive Summary:</strong> ${escapeHtml(snippet)}</p>`,
          '<ul>',
          ...bullets.map((b) => `<li>${escapeHtml(b)}</li>`),
          '</ul>',
        ].join('\n');

        return {
          summary: `Processed "${title}" (${plainContent.split(/\s+/).filter(Boolean).length} words) for ${action}.`,
          actions: bullets,
          suggestedHtml,
        };
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'AI assistant failed';
    return NextResponse.json({ error: message }, { status });
  }
}
