export interface TableFacetInput {
  headers: string[]
  rows: string[][]
}

export function generateTableFacet(input: TableFacetInput): string {
  const {headers, rows} = input

  // Calculate column widths
  const colWidths = headers.map((header, colIndex) => {
    const maxDataWidth = Math.max(...rows.map((row) => (row[colIndex] || '').length))
    return Math.max(header.length, maxDataWidth)
  })

  // Build the table
  const lines: string[] = []

  // Add prefix
  lines.push('@table:')

  // Add header row
  const headerRow = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |'
  lines.push(headerRow)

  // Add separator row
  const separator = '|' + colWidths.map((w) => '-'.repeat(w + 2)).join('|') + '|'
  lines.push(separator)

  // Add data rows
  for (const row of rows) {
    const dataCells = row.map((cell, j) => (cell || '').padEnd(colWidths[j])).join(' | ')
    const dataRow = '| ' + dataCells + ' |'
    lines.push(dataRow)
  }

  return lines.join('\n')
}
