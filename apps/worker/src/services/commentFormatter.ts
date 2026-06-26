/**
 * commentFormatter.ts — Educational GitHub Markdown comment formatter.
 *
 * Prepares user-friendly structured review feedback with:
 *   - Emoji severity mapping (🔴 critical, 🟠 high, 🟡 medium, 🔵 low, ⚪ info)
 *   - OWASP Reference validation (https://owasp.org/* whitelist)
 *   - AI disclaimer injection
 *   - Hard line truncation at 15 lines for code snippets
 *   - Max comment body truncation at 65,536 characters
 */

export interface StructuredComment {
  file: string;
  line: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'bug' | 'performance' | 'style';
  title: string;
  explanation: string;
  owasp_ref: string | null;
  owasp_url: string | null;
  fix_description: string;
  fix_code: string | null;
  fix_language: string | null;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  info: '⚪',
};

/**
 * Validates that an OWASP URL belongs to https://owasp.org/
 */
export function validateOwaspUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Must match https://owasp.org/* (must begin with https://owasp.org/)
  if (/^https:\/\/owasp\.org\//.test(url)) {
    return url;
  }
  return null;
}

/**
 * Hard truncates the AI-generated code snippet at 15 lines.
 */
export function truncateFixCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const lines = code.split('\n');
  if (lines.length > 15) {
    return lines.slice(0, 15).join('\n') + '\n// ... (truncated)';
  }
  return code;
}

/**
 * Formats a structured comment to GitHub Markdown.
 */
export function formatComment(comment: StructuredComment): string {
  const emoji = SEVERITY_EMOJI[comment.severity] || '⚪';
  const severityLabel = comment.severity.charAt(0).toUpperCase() + comment.severity.slice(1);

  let md = `### ⚠️ DevFlow CI: ${comment.title}\n`;
  md += `**Severity:** ${emoji} ${severityLabel}\n\n`;
  md += `**Why this is dangerous:**\n${comment.explanation}\n\n`;

  // Validate and display OWASP reference
  const validOwaspUrl = validateOwaspUrl(comment.owasp_url);
  if (comment.owasp_ref) {
    if (validOwaspUrl) {
      md += `**OWASP Reference:** [OWASP ${comment.owasp_ref}](${validOwaspUrl})\n\n`;
    } else {
      md += `**OWASP Reference:** OWASP ${comment.owasp_ref}\n\n`;
    }
  }

  md += `**Suggested Fix:**\n${comment.fix_description}\n\n`;

  // Display fix code block if present
  if (comment.fix_code) {
    const truncatedCode = truncateFixCode(comment.fix_code);
    const lang = comment.fix_language || 'typescript';
    md += `\`\`\`${lang}\n`;
    md += `// Secure code example replacing the flagged lines\n`;
    md += `// AI-generated fix — review before applying.\n`;
    md += `${truncatedCode}\n`;
    md += `\`\`\`\n\n`;
  }

  md += `> *DevFlow CI • Powered by Gemini 2.5 Flash • [Privacy Policy](https://devflow-ci.com/privacy)*`;

  return md;
}

/**
 * Helper to truncate GitHub comment body if it exceeds 65536 character limit.
 */
export function limitCommentLength(comment: string): string {
  const LIMIT = 65536;
  if (comment.length > LIMIT) {
    const note = '\n\n... (truncated)';
    return comment.slice(0, LIMIT - note.length) + note;
  }
  return comment;
}
