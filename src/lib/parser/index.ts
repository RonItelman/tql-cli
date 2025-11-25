import * as fs from 'node:fs'

import type {
  AmbiguityRow,
  ContextRow,
  IntentRow,
  MeaningRow,
  QueryRow,
  ScoreRow,
  StructureRow,
  TableRow,
  TasksRow,
  TqlConversation,
  TqlDocument,
} from './types.js'

/**
 * Parse a .tql file into a TqlConversation JSON structure
 */
export function parseTql(filePath: string): TqlConversation {
  const content = fs.readFileSync(filePath, 'utf8')
  return parseTqlConversationFromString(content)
}

/**
 * Parse TQL conversation content string into a TqlConversation structure
 */
export function parseTqlConversationFromString(content: string): TqlConversation {
  const lines = content.split('\n')
  const sequence: TqlConversation['sequence'] = []

  // Split content by #document[n]: or $diff(i,j): headers
  let currentItemKey: string | null = null
  let currentItemContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for document header: #document[n]: (with or without +)
    const docMatch = line.match(/^(#document\[\+?(\d+)\]):/)
    if (docMatch) {
      // Save previous item if exists
      if (currentItemKey && currentItemContent.length > 0) {
        addItemToSequence(sequence, currentItemKey, currentItemContent.join('\n'))
      }

      // Normalize to internal format with +
      currentItemKey = `#document[+${docMatch[2]}]`
      currentItemContent = []
      continue
    }

    // Check for diff header: $diff(i,j): or legacy $diff[+i→+j]:
    const diffMatch = line.match(/^(\$diff(?:\((\d+),(\d+)\)|\[\+?(\d+)→\+?(\d+)\])):/)
    if (diffMatch) {
      // Save previous item if exists
      if (currentItemKey && currentItemContent.length > 0) {
        addItemToSequence(sequence, currentItemKey, currentItemContent.join('\n'))
      }

      // Normalize to internal format with +
      const fromIdx = diffMatch[2] || diffMatch[4]
      const toIdx = diffMatch[3] || diffMatch[5]
      currentItemKey = `$diff[+${fromIdx}→+${toIdx}]`
      currentItemContent = []
      continue
    }

    // Collect lines for current item
    if (currentItemKey) {
      currentItemContent.push(line)
    }
  }

  // Process the last item
  if (currentItemKey && currentItemContent.length > 0) {
    addItemToSequence(sequence, currentItemKey, currentItemContent.join('\n'))
  }

  // If no items were found, try to parse as a single document (legacy format)
  if (sequence.length === 0) {
    const doc = parseTqlDocumentFromString(content)
    return {
      sequence: [{'#document[+0]': doc}],
    }
  }

  return {sequence}
}

/**
 * Helper to add an item to the sequence based on its key
 */
function addItemToSequence(sequence: TqlConversation['sequence'], key: string, content: string): void {
  if (key.startsWith('#document')) {
    // Parse document content
    const doc = parseTqlDocumentFromString(content)
    sequence.push({[key]: doc} as any)
  } else if (key.startsWith('$diff')) {
    // Parse diff markdown content back to TqlDiff structure
    const diff = parseDiffFromString(content)
    sequence.push({[key]: diff} as any)
  }
}

/**
 * Parse diff markdown content back into TqlDiff structure
 * This reconstructs the TqlDiff object from the markdown tables
 */
function parseDiffFromString(content: string): any {
  const lines = content.split('\n')
  const facets: any[] = []

  let currentFacet: string | null = null
  let currentChanges: any[] = []
  let inTable = false
  let headers: string[] = []
  let rowIndex = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Match facet headers like @meaning:
    const facetMatch = trimmed.match(/^@(\w+):/)
    if (facetMatch) {
      // Save previous facet if exists
      if (currentFacet && currentChanges.length > 0) {
        facets.push({
          facetName: currentFacet,
          changes: currentChanges,
          status: 'modified' as const,
          rowsBefore: 0, // Not stored in markdown, placeholder
          rowsAfter: 0,  // Not stored in markdown, placeholder
        })
      }

      currentFacet = facetMatch[1]
      currentChanges = []
      inTable = false
      rowIndex = 0
      continue
    }

    // Parse table header
    if (trimmed.startsWith('|') && !inTable && !isSeparatorRow(trimmed)) {
      headers = parseTableRow(trimmed)
      inTable = true
      continue
    }

    // Skip separator row
    if (isSeparatorRow(trimmed)) {
      continue
    }

    // Parse data rows
    if (inTable && trimmed.startsWith('|') && currentFacet) {
      const cells = parseTableRow(trimmed)
      const delta = cells[0] // First column is Δ

      // Build row object from headers and cells
      const row: any = {}
      for (let i = 1; i < headers.length; i++) {
        row[headers[i]] = cells[i] || ''
      }

      // Determine change type based on delta symbol
      if (delta === '+') {
        currentChanges.push({
          type: 'added',
          after: row,
          index: rowIndex,
        })
      } else if (delta === '-') {
        currentChanges.push({
          type: 'removed',
          before: row,
          index: rowIndex,
        })
      }

      rowIndex++
    }
  }

  // Save last facet
  if (currentFacet && currentChanges.length > 0) {
    facets.push({
      facetName: currentFacet,
      changes: mergeModifiedChanges(currentChanges),
      status: 'modified' as const,
      rowsBefore: 0,
      rowsAfter: 0,
    })
  }

  return {
    facets,
    status: 'success',
    summary: {
      totalFacetsChanged: facets.length,
      totalFacetsUnchanged: 0,
      totalRowChanges: facets.reduce((sum: number, f: any) => sum + f.changes.length, 0),
    },
  }
}

/**
 * Merge consecutive removed/added changes with same index into modified changes
 */
function mergeModifiedChanges(changes: any[]): any[] {
  const merged: any[] = []
  const indexMap = new Map<string, any>()

  for (const change of changes) {
    const idx = change.index

    if (change.type === 'removed') {
      // Check if we already have an added change for this index
      if (indexMap.has(idx) && indexMap.get(idx).type === 'added') {
        const added = indexMap.get(idx)
        merged.push({
          type: 'modified',
          before: change.before,
          after: added.after,
          index: idx,
          modifiedFields: [], // Not available from markdown
        })
        indexMap.delete(idx)
      } else {
        indexMap.set(idx, change)
      }
    } else if (change.type === 'added') {
      // Check if we already have a removed change for this index
      if (indexMap.has(idx) && indexMap.get(idx).type === 'removed') {
        const removed = indexMap.get(idx)
        merged.push({
          type: 'modified',
          before: removed.before,
          after: change.after,
          index: idx,
          modifiedFields: [], // Not available from markdown
        })
        indexMap.delete(idx)
      } else {
        indexMap.set(idx, change)
      }
    }
  }

  // Add any remaining standalone changes
  for (const change of indexMap.values()) {
    merged.push(change)
  }

  return merged
}

/**
 * Parse TQL document content string into a TqlDocument structure
 * (internal function - parses facets only, no conversation wrapper)
 */
export function parseTqlDocumentFromString(content: string): TqlDocument {
  const lines = content.split('\n')

  const doc: TqlDocument = {
    ambiguity: {rows: []},
    context: {rows: []},
    intent: {rows: []},
    meaning: {rows: []},
    query: {rows: []},
    score: {rows: []},
    structure: {rows: []},
    table: {rows: []},
    tasks: {rows: []},
  }

  let currentFacet: null | string = null
  let currentHeaders: string[] = []
  let inDataSection = false
  let headerParsed = false

  for (const line_ of lines) {
    const line = line_.trim()

    // Detect end of table section (empty line after table)
    if (line === '' && currentHeaders.length > 0) {
      currentHeaders = []
      inDataSection = false
      headerParsed = false
      continue
    }

    // Detect facet headers (e.g., @table[25]:)
    const facetName = parseFacetHeader(line)
    if (facetName) {
      currentFacet = facetName
      inDataSection = true
      headerParsed = false
      currentHeaders = []
      continue
    }

    // Skip empty lines or lines without a current facet
    if (!line || !currentFacet) continue

    // Skip separator rows (mark header as parsed)
    if (isSeparatorRow(line)) {
      headerParsed = true
      continue
    }

    // Parse table header row
    if (inDataSection && isTableRow(line) && !headerParsed && currentHeaders.length === 0) {
      currentHeaders = parseTableRow(line)
      continue
    }

    // Parse data rows (only after header is parsed)
    if (inDataSection && headerParsed && isTableRow(line)) {
      const cells = parseTableRow(line)
      const row: Record<string, string> = {}

      for (const [j, currentHeader] of currentHeaders.entries()) {
        row[currentHeader] = cells[j] || ''
      }

      addRowToFacet(doc, currentFacet, row)
    }
  }

  return doc
}

/**
 * Parse a markdown table row into an array of cell values
 */
function parseTableRow(line: string): string[] {
  // Remove leading and trailing pipes and split by pipe
  const trimmed = line.trim().slice(1, -1) // Remove first and last |
  const cells = trimmed.split('|').map((cell) => cell.trim())
  return cells
}

/**
 * Check if a line is a markdown table separator (e.g., |---|---|)
 */
function isSeparatorRow(line: string): boolean {
  return /^\|[-\s|]+\|$/.test(line)
}

/**
 * Check if a line is a table row (starts with |)
 */
function isTableRow(line: string): boolean {
  return line.startsWith('|')
}

/**
 * Parse facet header and return facet name if found
 * (e.g., @table: returns 'table')
 */
function parseFacetHeader(line: string): null | string {
  const facetMatch = line.match(/^@(\w+):/)
  return facetMatch ? facetMatch[1] : null
}

/**
 * Facet registry: maps facet names to functions that add rows to the document
 * This pattern makes it easy to add new facets without modifying parser logic
 */
const FACET_REGISTRY: Record<string, (doc: TqlDocument, row: Record<string, string>) => void> = {
  ambiguity: (doc, row) => doc.ambiguity.rows.push(row as unknown as AmbiguityRow),
  context: (doc, row) => doc.context.rows.push(row as unknown as ContextRow),
  intent: (doc, row) => doc.intent.rows.push(row as unknown as IntentRow),
  meaning: (doc, row) => doc.meaning.rows.push(row as unknown as MeaningRow),
  query: (doc, row) => doc.query.rows.push(row as unknown as QueryRow),
  score: (doc, row) => doc.score.rows.push(row as unknown as ScoreRow),
  structure: (doc, row) => doc.structure.rows.push(row as unknown as StructureRow),
  table: (doc, row) => doc.table.rows.push(row as unknown as TableRow),
  tasks: (doc, row) => doc.tasks.rows.push(row as unknown as TasksRow),
}

/**
 * Add a row to the appropriate facet in the document using the registry pattern
 */
function addRowToFacet(doc: TqlDocument, facet: string, row: Record<string, string>): void {
  const addRow = FACET_REGISTRY[facet]
  if (addRow) {
    addRow(doc, row)
  }
}

/**
 * Export TQL document to JSON file (optional, for debugging)
 */
export function writeTqlJson(filePath: string, doc: TqlDocument): void {
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8')
}
