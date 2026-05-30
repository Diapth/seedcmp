import MarkdownIt from 'markdown-it';

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

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false
});

const defaultFence = markdownIt.renderer.rules.fence;
const defaultLinkOpen = markdownIt.renderer.rules.link_open;

markdownIt.renderer.rules.fence = (tokens: any[], idx: number, options, env: any, self: any) => {
  const token = tokens[idx];
  const language = normalizeCodeLanguage(`\`\`\`${token.info || ''}`);
  const index = Number(env.codeIndex || 0);
  env.codeIndex = index + 1;
  if (!token.content && defaultFence) {
    return defaultFence(tokens, idx, options, env, self);
  }
  return renderCodeBlock(token.content || '', language, index);
};

markdownIt.renderer.rules.link_open = (tokens: any[], idx: number, options, env, self: any) => {
  const token = tokens[idx];
  const href = token.attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

function stripOuterTrailingNewline(html: string) {
  return html.endsWith('\n') ? html.slice(0, -1) : html;
}

export function renderMarkdown(markdown: string) {
  return stripOuterTrailingNewline(markdownIt.render(String(markdown || ''), { codeIndex: 0 }));
}
