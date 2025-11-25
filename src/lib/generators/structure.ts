export interface StructureFacetInput {
  headers: string[]
}

interface ColumnStructure {
  column: string
  dataType: string
  format: string
  maxValue: string
  minValue: string
  nullAllowed: string
}

export function generateStructureFacet(input: StructureFacetInput): string {
  const {headers} = input

  // Create structure template for each column (all fields blank except column name)
  const structures: ColumnStructure[] = headers.map((header) => ({
    column: header,
    dataType: '',
    format: '',
    maxValue: '',
    minValue: '',
    nullAllowed: '',
  }))

  // Calculate column widths
  const colWidths = {
    column: Math.max(...structures.map((s) => s.column.length), 'column'.length),
    dataType: 'dataType'.length,
    format: 'format'.length,
    maxValue: 'maxValue'.length,
    minValue: 'minValue'.length,
    nullAllowed: 'nullAllowed'.length,
  }

  // Build the table
  const lines: string[] = []

  // Add prefix
  lines.push('@structure:')

  // Add header row
  const headerRow =
    '| ' +
    'column'.padEnd(colWidths.column) +
    ' | ' +
    'nullAllowed'.padEnd(colWidths.nullAllowed) +
    ' | ' +
    'dataType'.padEnd(colWidths.dataType) +
    ' | ' +
    'minValue'.padEnd(colWidths.minValue) +
    ' | ' +
    'maxValue'.padEnd(colWidths.maxValue) +
    ' | ' +
    'format'.padEnd(colWidths.format) +
    ' |'
  lines.push(headerRow)

  // Add separator row
  const separator =
    '|' +
    '-'.repeat(colWidths.column + 2) +
    '|' +
    '-'.repeat(colWidths.nullAllowed + 2) +
    '|' +
    '-'.repeat(colWidths.dataType + 2) +
    '|' +
    '-'.repeat(colWidths.minValue + 2) +
    '|' +
    '-'.repeat(colWidths.maxValue + 2) +
    '|' +
    '-'.repeat(colWidths.format + 2) +
    '|'
  lines.push(separator)

  // Add data rows (all fields blank except column name)
  for (const structure of structures) {
    const dataRow =
      '| ' +
      structure.column.padEnd(colWidths.column) +
      ' | ' +
      structure.nullAllowed.padEnd(colWidths.nullAllowed) +
      ' | ' +
      structure.dataType.padEnd(colWidths.dataType) +
      ' | ' +
      structure.minValue.padEnd(colWidths.minValue) +
      ' | ' +
      structure.maxValue.padEnd(colWidths.maxValue) +
      ' | ' +
      structure.format.padEnd(colWidths.format) +
      ' |'
    lines.push(dataRow)
  }

  return lines.join('\n')
}
