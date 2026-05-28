function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeCodeLanguage(fence: string) {
  return fence.replace(/^```/, '').trim().split(/\s+/)[0].toLowerCase();
}

function isHtmlLanguage(language: string) {
  return ['html', 'htm'].includes(language);
}

function renderCodeBlock(code: string, language: string, index: number) {
  const label = language || 'code';
  const previewButton = isHtmlLanguage(language)
    ? '<button type="button" class="markdown-code-action" data-code-action="preview-html">预览</button>'
    : '';
  return [
    `<div class="markdown-code-block" data-code-index="${index}" data-code-language="${escapeAttribute(language)}">`,
    '<div class="markdown-code-header">',
    `<span class="markdown-code-lang">${escapeHtml(label)}</span>`,
    '<div class="markdown-code-actions">',
    previewButton,
    '<button type="button" class="markdown-code-action" data-code-action="copy">复制</button>',
    '</div>',
    '</div>',
    `<pre><code data-code-index="${index}">${escapeHtml(code)}</code></pre>`,
    '</div>'
  ].join('');
}

function renderInlineMarkdown(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
}

export function renderMarkdown(markdown: string) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLanguage = '';
  let codeIndex = 0;
  let inList = false;
  let inOrderedList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    if (inOrderedList) {
      html.push('</ol>');
      inOrderedList = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(renderCodeBlock(codeLines.join('\n'), codeLanguage, codeIndex));
        codeIndex += 1;
        codeLines = [];
        codeLanguage = '';
        inCode = false;
      } else {
        closeList();
        inCode = true;
        codeLanguage = normalizeCodeLanguage(line.trim());
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      if (!inOrderedList) {
        html.push('<ol>');
        inOrderedList = true;
      }
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (inOrderedList) {
        html.push('</ol>');
        inOrderedList = false;
      }
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  if (inCode) {
    html.push(renderCodeBlock(codeLines.join('\n'), codeLanguage, codeIndex));
  }
  closeList();
  return html.join('');
}
