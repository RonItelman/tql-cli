export function generateAmbiguityFacet(): string {
  const headers = ['query_trigger', 'ambiguity_type', 'ambiguity_risk']

  // Calculate column widths based on header names
  const colWidths = headers.map((h) => h.length)

  // Build the table
  const lines: string[] = []

  // Add prefix
  lines.push('@ambiguity:')

  // Add header row
  const headerRow = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |'
  lines.push(headerRow)

  // Add separator row
  const separator = '|' + colWidths.map((w) => '-'.repeat(w + 2)).join('|') + '|'
  lines.push(separator)

  // No data rows on initialization

  return lines.join('\n')
}
