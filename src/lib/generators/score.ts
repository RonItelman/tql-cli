export function generateScoreFacet(): string {
  const headers = ['measure', 'value']
  const measures = [
    'range-values',
    'number-of-interpretations',
    'Uncertainty Ratio (UR)',
    'Missing Certainty Ratio',
  ]

  // Calculate column widths
  const measureWidth = Math.max(...measures.map((m) => m.length), 'measure'.length)
  const valueWidth = 'value'.length

  // Build the table
  const lines: string[] = []

  // Add prefix
  lines.push(
    '@score:',
    // Add header row
    `| ${headers[0].padEnd(measureWidth)} | ${headers[1].padEnd(valueWidth)} |`,
    // Add separator row
    `|${'-'.repeat(measureWidth + 2)}|${'-'.repeat(valueWidth + 2)}|`
  )

  // Add measure rows (with empty values)
  for (const measure of measures) {
    lines.push(`| ${measure.padEnd(measureWidth)} | ${' '.repeat(valueWidth)} |`)
  }

  return lines.join('\n')
}
