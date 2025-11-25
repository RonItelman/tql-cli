export interface MeaningFacetInput {
  headers: string[]
}

export function generateMeaningFacet(input: MeaningFacetInput): string {
  const {headers} = input

  // Define column widths for the meaning table
  const columnWidth = Math.max(...headers.map((h) => h.length), 'column'.length)
  const definitionWidth = 'definition'.length

  // Build the table
  const lines: string[] = []

  // Add prefix
  lines.push('@meaning:')

  // Add header row
  const headerRow =
    '| ' +
    'column'.padEnd(columnWidth) +
    ' | ' +
    'definition'.padEnd(definitionWidth) +
    ' |'
  lines.push(headerRow)

  // Add separator row
  const separator =
    '|' +
    '-'.repeat(columnWidth + 2) +
    '|' +
    '-'.repeat(definitionWidth + 2) +
    '|'
  lines.push(separator)

  // Add data rows (one per column, with blank definition)
  for (const header of headers) {
    const dataRow =
      '| ' +
      header.padEnd(columnWidth) +
      ' | ' +
      ''.padEnd(definitionWidth) +
      ' |'
    lines.push(dataRow)
  }

  return lines.join('\n')
}
