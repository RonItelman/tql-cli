import * as fs from 'node:fs'

import {formatDiffAsMarkdown} from '../operations/diff.js'
import type {TqlConversation, TqlDocument} from './types.js'
import {getDocumentCount} from './types.js'

/**
 * Generate a .tql file from a TqlConversation JSON structure
 */
export function generateTqlFromConversation(conversation: TqlConversation): string {
  const sections: string[] = []

  // Iterate through sequence and output each item
  for (let i = 0; i < conversation.sequence.length; i++) {
    const item = conversation.sequence[i]
    const key = Object.keys(item)[0]
    const value = Object.values(item)[0]

    if (key.startsWith('#document')) {
      // Extract document index and output with new format
      const match = key.match(/\#document\[\+?(\d+)\]/)
      const docIndex = match ? match[1] : '0'
      sections.push(`#document[${docIndex}]:`)
      sections.push(generateTqlFromJson(value as TqlDocument))
    } else if (key.startsWith('$diff')) {
      // Extract diff indices and output with new format: $diff(from,to):
      const match = key.match(/\$diff\[\+?(\d+)→\+?(\d+)\]/)
      if (match) {
        sections.push(`$diff(${match[1]},${match[2]}):`)
      } else {
        sections.push(`${key}:`)
      }
      sections.push(formatDiffAsMarkdown(value as any, false)) // No colors in file
    }

    // Add empty line between items (except after last)
    if (i < conversation.sequence.length - 1) {
      sections.push('')
    }
  }

  return sections.join('\n')
}

/**
 * Generate facets content for a single TqlDocument
 * (Used internally by generateTqlFromConversation)
 */
export function generateTqlFromJson(doc: TqlDocument): string {
  const sections: string[] = []

  // Generate all 9 facets (always, even if empty)
  sections.push(generateTableSection(doc))
  sections.push(generateMeaningSection(doc))
  sections.push(generateStructureSection(doc))
  sections.push(generateAmbiguitySection(doc))
  sections.push(generateIntentSection(doc))
  sections.push(generateContextSection(doc))
  sections.push(generateQuerySection(doc))
  sections.push(generateTasksSection(doc))
  sections.push(generateScoreSection(doc))

  return sections.join('\n\n')
}

/**
 * Write TQL conversation to file
 */
export function writeTql(filePath: string, conversation: TqlConversation): void {
  const content = generateTqlFromConversation(conversation)
  fs.writeFileSync(filePath, content, 'utf8')
}

// Helper function to generate a table section
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateTable(headers: string[], rows: Record<string, any>[], facetName: string): string {
  const lines: string[] = []

  // Add facet header (no row count)
  lines.push(`@${facetName}:`)

  // Calculate column widths
  const colWidths: number[] = headers.map((header) => {
    const headerWidth = header.length
    const maxDataWidth = rows.length > 0
      ? Math.max(...rows.map((row) => String(row[header] || '').length))
      : 0
    return Math.max(headerWidth, maxDataWidth)
  })

  // Add header row
  const headerRow = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |'
  lines.push(headerRow)

  // Add separator row
  const separator = '|' + colWidths.map((w) => '-'.repeat(w + 2)).join('|') + '|'
  lines.push(separator)

  // Add data rows
  for (const row of rows) {
    const dataRow = '| ' + headers.map((h, i) => String(row[h] || '').padEnd(colWidths[i])).join(' | ') + ' |'
    lines.push(dataRow)
  }

  return lines.join('\n')
}

function generateTableSection(doc: TqlDocument): string {
  if (doc.table.rows.length === 0) {
    // Return empty table with no columns
    return generateTable([], [], 'table')
  }

  // Get all column names from the first row
  const firstRow = doc.table.rows[0]
  const headers = Object.keys(firstRow)

  return generateTable(headers, doc.table.rows, 'table')
}

function generateMeaningSection(doc: TqlDocument): string {
  const headers = ['column', 'definition']
  return generateTable(headers, doc.meaning.rows, 'meaning')
}

function generateStructureSection(doc: TqlDocument): string {
  const headers = ['column', 'nullAllowed', 'dataType', 'minValue', 'maxValue', 'format']
  return generateTable(headers, doc.structure.rows, 'structure')
}

function generateAmbiguitySection(doc: TqlDocument): string {
  const headers = ['query_trigger', 'ambiguity_type', 'ambiguity_risk']
  return generateTable(headers, doc.ambiguity.rows, 'ambiguity')
}

function generateIntentSection(doc: TqlDocument): string {
  const headers = ['query_trigger', 'clarifying_question', 'options', 'user_response', 'user_confirmed']
  return generateTable(headers, doc.intent.rows, 'intent')
}

function generateContextSection(doc: TqlDocument): string {
  const headers = ['key', 'value']
  return generateTable(headers, doc.context.rows, 'context')
}

function generateQuerySection(doc: TqlDocument): string {
  const headers = ['user_message', 'timestamp_utc']
  return generateTable(headers, doc.query.rows, 'query')
}

function generateTasksSection(doc: TqlDocument): string {
  const headers = ['name', 'description', 'formula']
  return generateTable(headers, doc.tasks.rows, 'tasks')
}

function generateScoreSection(doc: TqlDocument): string {
  const headers = ['measure', 'value']
  return generateTable(headers, doc.score.rows, 'score')
}
