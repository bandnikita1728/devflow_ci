/**
 * commentFormatter.test.ts — Unit tests for commentFormatter.ts
 */

import {
  validateOwaspUrl,
  truncateFixCode,
  formatComment,
  limitCommentLength,
  StructuredComment,
} from '../services/commentFormatter';

describe('Comment Formatter Service', () => {
  // ── 1. validateOwaspUrl ─────────────────────────────────────────────────────
  describe('validateOwaspUrl', () => {
    it('should allow valid owasp.org URLs', () => {
      expect(validateOwaspUrl('https://owasp.org/Top10/A03_2021-Injection/')).toBe(
        'https://owasp.org/Top10/A03_2021-Injection/'
      );
      expect(validateOwaspUrl('https://owasp.org/abc')).toBe('https://owasp.org/abc');
    });

    it('should reject URLs that do not start with https://owasp.org/', () => {
      expect(validateOwaspUrl('https://hacker.com/owasp.org/')).toBeNull();
      expect(validateOwaspUrl('http://owasp.org/')).toBeNull(); // http not allowed
      expect(validateOwaspUrl('ftp://owasp.org/')).toBeNull();
      expect(validateOwaspUrl(null)).toBeNull();
      expect(validateOwaspUrl(undefined)).toBeNull();
    });
  });

  // ── 2. truncateFixCode ──────────────────────────────────────────────────────
  describe('truncateFixCode', () => {
    it('should keep code unchanged if it is 15 lines or less', () => {
      const code = 'line 1\nline 2\nline 3';
      expect(truncateFixCode(code)).toBe(code);
    });

    it('should truncate code and add truncation comment if it is more than 15 lines', () => {
      const code = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
      const expected = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n') + '\n// ... (truncated)';
      expect(truncateFixCode(code)).toBe(expected);
    });

    it('should return null/undefined for falsy values', () => {
      expect(truncateFixCode(null)).toBeNull();
      expect(truncateFixCode(undefined)).toBeNull();
    });
  });

  // ── 3. formatComment ────────────────────────────────────────────────────────
  describe('formatComment', () => {
    const baseComment: StructuredComment = {
      file: 'src/index.ts',
      line: 42,
      severity: 'critical',
      category: 'security',
      title: 'SQL Injection Risk',
      explanation: 'Passing user input directly to raw query.',
      owasp_ref: 'A03:2021',
      owasp_url: 'https://owasp.org/Top10/A03_2021-Injection/',
      fix_description: 'Use parameterized queries instead.',
      fix_code: 'db.query("SELECT * FROM users WHERE id = $1", [id]);',
      fix_language: 'typescript',
    };

    it('should format all fields correctly including emoji, disclaimers, and links', () => {
      const output = formatComment(baseComment);

      expect(output).toContain('### ⚠️ DevFlow CI: SQL Injection Risk');
      expect(output).toContain('**Severity:** 🔴 Critical');
      expect(output).toContain('**Why this is dangerous:**\nPassing user input directly to raw query.');
      expect(output).toContain('**OWASP Reference:** [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)');
      expect(output).toContain('**Suggested Fix:**\nUse parameterized queries instead.');
      expect(output).toContain('```typescript');
      expect(output).toContain('// Secure code example replacing the flagged lines');
      expect(output).toContain('// AI-generated fix — review before applying.');
      expect(output).toContain('db.query("SELECT * FROM users WHERE id = $1", [id]);');
      expect(output).toContain('Privacy Policy');
    });

    it('should omit OWASP link rendering as plain text if URL is invalid', () => {
      const comment = {
        ...baseComment,
        owasp_url: 'https://invalid-site.com/owasp',
      };
      const output = formatComment(comment);
      expect(output).toContain('**OWASP Reference:** OWASP A03:2021');
      expect(output).not.toContain('(https://invalid-site.com/owasp)');
    });

    it('should omit OWASP reference line completely if owasp_ref is null', () => {
      const comment = {
        ...baseComment,
        owasp_ref: null,
      };
      const output = formatComment(comment);
      expect(output).not.toContain('**OWASP Reference:**');
    });

    it('should omit code block but keep fix description if fix_code is null', () => {
      const comment = {
        ...baseComment,
        fix_code: null,
      };
      const output = formatComment(comment);
      expect(output).toContain('**Suggested Fix:**\nUse parameterized queries instead.');
      expect(output).not.toContain('```');
      expect(output).not.toContain('// AI-generated fix');
    });

    it('should respect custom severities and languages', () => {
      const comment: StructuredComment = {
        ...baseComment,
        severity: 'low',
        fix_language: 'python',
        fix_code: 'print("hello")',
      };
      const output = formatComment(comment);
      expect(output).toContain('**Severity:** 🔵 Low');
      expect(output).toContain('```python');
    });
  });

  // ── 4. limitCommentLength ───────────────────────────────────────────────────
  describe('limitCommentLength', () => {
    it('should keep short comments intact', () => {
      const comment = 'hello world';
      expect(limitCommentLength(comment)).toBe(comment);
    });

    it('should truncate comments exceeding 65536 characters and append truncated note', () => {
      const longComment = 'a'.repeat(70000);
      const output = limitCommentLength(longComment);

      expect(output.length).toBe(65536);
      expect(output.endsWith('\n\n... (truncated)')).toBe(true);
    });
  });
});
