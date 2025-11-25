import type {FacetDiff, RowChange, TqlConversation, TqlDiff, TqlDocument} from '../parser/types.js'
import {getDocuments} from '../parser/types.js'

/**
 * Compare two TQL documents and return a structured diff
 * Throws error if @table differs between documents
 */
export function diffTqlDocuments(before: TqlDocument, after: TqlDocument): TqlDiff {
  // Check if @table matches exactly
  const tableMatches = deepEqual(before.table.rows, after.table.rows)

  if (!tableMatches) {
    throw new Error('DIFF operations can only be performed on matching datasets')
  }

  // Compute diffs for each facet
  const facetDiffs: FacetDiff[] = []
  const facetNames: Array<keyof TqlDocument> = [
    'table',
    'meaning',
    'structure',
    'ambiguity',
    'intent',
    'context',
    'query',
    'tasks',
    'score',
  ]

  for (const facetName of facetNames) {
    const facetDiff = computeFacetDiff(facetName, before[facetName].rows, after[facetName].rows)
    facetDiffs.push(facetDiff)
  }

  // Calculate summary
  const facetsChanged = facetDiffs.filter((f) => f.status !== 'unchanged').length
  const facetsUnchanged = facetDiffs.filter((f) => f.status === 'unchanged').length
  const totalRowChanges = facetDiffs.reduce((sum, f) => sum + f.changes.length, 0)

  return {
    facets: facetDiffs,
    status: 'success',
    summary: {
      totalFacetsChanged: facetsChanged,
      totalFacetsUnchanged: facetsUnchanged,
      totalRowChanges,
    },
  }
}

/**
 * Diff two documents from a conversation by index
 */
export function diffConversationStep(
  conversation: TqlConversation,
  fromIndex: number,
  toIndex: number,
): TqlDiff {
  const documents = getDocuments(conversation)

  if (fromIndex < 0 || fromIndex >= documents.length) {
    throw new Error(`Invalid fromIndex: ${fromIndex}`)
  }

  if (toIndex < 0 || toIndex >= documents.length) {
    throw new Error(`Invalid toIndex: ${toIndex}`)
  }

  const before = documents[fromIndex]
  const after = documents[toIndex]

  return diffTqlDocuments(before, after)
}

/**
 * Compute diff for a single facet
 */
function computeFacetDiff(
  facetName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  afterRows: any[],
): FacetDiff {
  const changes: RowChange[] = []

  // Create maps by array index for easy lookup
  const beforeMap = new Map(beforeRows.map((row, idx) => [idx, row]))
  const afterMap = new Map(afterRows.map((row, idx) => [idx, row]))

  // Get all unique indices
  const allIndices = new Set([...afterMap.keys(), ...beforeMap.keys()])

  for (const index of allIndices) {
    const beforeRow = beforeMap.get(index)
    const afterRow = afterMap.get(index)

    if (!beforeRow && afterRow) {
      // Row added
      changes.push({
        after: afterRow as Record<string, string>,
        index,
        type: 'added',
      })
    } else if (beforeRow && !afterRow) {
      // Row removed
      changes.push({
        before: beforeRow as Record<string, string>,
        index,
        type: 'removed',
      })
    } else if (beforeRow && afterRow) {
      // Check if row modified
      const modifiedFields = getModifiedFields(beforeRow, afterRow)
      if (modifiedFields.length > 0) {
        changes.push({
          after: afterRow as Record<string, string>,
          before: beforeRow as Record<string, string>,
          index,
          modifiedFields,
          type: 'modified',
        })
      }
    }
  }

  // Determine facet status
  let status: 'added' | 'modified' | 'removed' | 'unchanged' = 'unchanged'
  if (beforeRows.length === 0 && afterRows.length > 0) {
    status = 'added'
  } else if (beforeRows.length > 0 && afterRows.length === 0) {
    status = 'removed'
  } else if (changes.length > 0) {
    status = 'modified'
  }

  return {
    changes,
    facetName,
    rowsAfter: afterRows.length,
    rowsBefore: beforeRows.length,
    status,
  }
}

/**
 * Get list of fields that changed between two rows
 */
function getModifiedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const allKeys = new Set([...Object.keys(after), ...Object.keys(before)])
  const modifiedFields: string[] = []

  for (const key of allKeys) {
    if (key === 'index') continue // Skip index field
    if (before[key] !== after[key]) {
      modifiedFields.push(key)
    }
  }

  return modifiedFields
}

/**
 * Deep equality check for table rows
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

// ANSI color codes for terminal output
const COLORS = {
  green: '\u001B[32m',
  red: '\u001B[31m',
  reset: '\u001B[0m',
  yellow: '\u001B[33m',
}

/**
 * Format diff as markdown tables with terminal colors
 * Git-style: red for deletions (-), green for additions (+)
 */
export function formatDiffAsMarkdown(diff: TqlDiff, useColors = true): string {
  if (diff.status === 'table_changed') {
    return 'Error: DIFF operations can only be performed on matching datasets'
  }

  const sections: string[] = []

  // Show each facet that changed (only changed facets)
  const changedFacets = diff.facets.filter((f) => f.status !== 'unchanged')

  if (changedFacets.length === 0) {
    sections.push('No changes detected.')
  } else {
    for (const facet of changedFacets) {
      sections.push(formatFacetDiff(facet, useColors))
    }
  }

  return sections.join('\n\n')
}

/**
 * Format a single facet diff as a markdown table
 */
function formatFacetDiff(facet: FacetDiff, useColors: boolean): string {
  const lines: string[] = []

  // Use @facet[n] syntax where n is number of changes
  lines.push(`@${facet.facetName}[${facet.changes.length}]:`)

  if (facet.changes.length === 0) {
    return lines.join('\n')
  }

  // Get all column names from the first row (before or after)
  const firstChange = facet.changes[0]
  const sampleRow = firstChange.before || firstChange.after
  if (!sampleRow) return lines.join('\n')

  const columns = Object.keys(sampleRow)

  // Build table header
  const headerCols = ['Δ', ...columns]
  const colWidths = headerCols.map((col) => Math.max(col.length, 3))

  // Calculate column widths based on data
  for (const change of facet.changes) {
    const rows = [change.before, change.after].filter(Boolean) as Record<string, string>[]
    for (const row of rows) {
      for (const [i, col] of columns.entries()) {
        const value = String(row[col] || '')
        colWidths[i + 1] = Math.max(colWidths[i + 1], value.length)
      }
    }
  }

  // Header row
  const headerRow = '| ' + headerCols.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |'
  lines.push('', headerRow)

  // Separator row
  const separator = '|' + colWidths.map((w) => '-'.repeat(w + 2)).join('|') + '|'
  lines.push(separator)

  // Data rows
  for (const change of facet.changes) {
    switch (change.type) {
    case 'added': {
      // Single row with +
      const cells = columns.map((col, i) => String(change.after![col] || '').padEnd(colWidths[i + 1]))
      const delta = useColors ? `${COLORS.green}+${COLORS.reset}` : '+'
      const row = `| ${delta.padEnd(colWidths[0])} | ${cells.join(' | ')} |`
      lines.push(useColors ? colorizeRow(row, 'green') : row)
    
    break;
    }

    case 'modified': {
      // Two rows: - (before) and + (after)
      const beforeCells = columns.map((col, i) => String(change.before![col] || '').padEnd(colWidths[i + 1]))
      const afterCells = columns.map((col, i) => String(change.after![col] || '').padEnd(colWidths[i + 1]))

      const deltaMinus = useColors ? `${COLORS.red}-${COLORS.reset}` : '-'
      const deltaPlus = useColors ? `${COLORS.green}+${COLORS.reset}` : '+'

      const beforeRow = `| ${deltaMinus.padEnd(colWidths[0])} | ${beforeCells.join(' | ')} |`
      const afterRow = `| ${deltaPlus.padEnd(colWidths[0])} | ${afterCells.join(' | ')} |`

      lines.push(
        useColors ? colorizeRow(beforeRow, 'red') : beforeRow,
        useColors ? colorizeRow(afterRow, 'green') : afterRow
      )
    
    break;
    }

    case 'removed': {
      // Single row with -
      const cells = columns.map((col, i) => String(change.before![col] || '').padEnd(colWidths[i + 1]))
      const delta = useColors ? `${COLORS.red}-${COLORS.reset}` : '-'
      const row = `| ${delta.padEnd(colWidths[0])} | ${cells.join(' | ')} |`
      lines.push(useColors ? colorizeRow(row, 'red') : row)
    
    break;
    }
    // No default
    }
  }

  return lines.join('\n')
}

/**
 * Colorize an entire row (except the delta symbol which is already colored)
 */
function colorizeRow(row: string, color: 'green' | 'red'): string {
  const colorCode = color === 'red' ? COLORS.red : COLORS.green
  return `${colorCode}${row}${COLORS.reset}`
}

/**
 * Format diff as JSON string (for browser/API usage)
 */
export function formatDiffAsJson(diff: TqlDiff): string {
  return JSON.stringify(diff, null, 2)
}
