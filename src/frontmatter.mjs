import { parse as parseYaml } from 'yaml'

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * Splits a Backlog.md file into its YAML frontmatter and Markdown body.
 * Files without frontmatter come back with empty data, so the caller decides
 * whether that still counts as a task.
 */
export function splitFrontmatter(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const match = FRONTMATTER_RE.exec(source)
  if (!match) {
    return { data: {}, body: source }
  }
  const data = parseYaml(preprocessFrontmatter(match[1]), { uniqueKeys: false }) ?? {}
  return {
    data: typeof data === 'object' && !Array.isArray(data) ? data : {},
    body: source.slice(match[0].length)
  }
}

/**
 * Backlog.md writes `assignee: @sara` and `assignee: [@sara, @tom]`, which strict
 * YAML rejects because `@` is a reserved indicator. Backlog.md quotes these
 * before parsing (src/markdown/frontmatter.ts upstream); do the same.
 */
export function preprocessFrontmatter(frontmatter) {
  return frontmatter
    .split(/\r?\n/)
    .map((line) => {
      const match = /^(\s*(?:assignee|reporter)\s*:\s*)(.*)$/.exec(line)
      if (!match) {
        return line
      }
      const [, prefix, raw] = match
      const value = raw.trim()
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim()
        if (!inner) {
          return line
        }
        const entries = inner.split(',').map((entry) => quoteScalar(entry.trim()))
        return `${prefix}[${entries.join(', ')}]`
      }
      if (value && !/^['"[-]/.test(value)) {
        return `${prefix}${quoteScalar(value)}`
      }
      return line
    })
    .join('\n')
}

function quoteScalar(value) {
  if (/^['"]/.test(value)) {
    return value
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
