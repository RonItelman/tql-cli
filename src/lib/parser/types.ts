// Type definitions for TQL document structure

export interface TqlDocument {
  ambiguity: AmbiguityFacet
  context: ContextFacet
  intent: IntentFacet
  meaning: MeaningFacet
  query: QueryFacet
  score: ScoreFacet
  structure: StructureFacet
  table: TableFacet
  tasks: TasksFacet
}

export interface TableFacet {
  rows: TableRow[]
}

export interface TableRow {
  [key: string]: number | string  // Dynamic columns from CSV
}

export interface MeaningFacet {
  rows: MeaningRow[]
}

export interface MeaningRow {
  column: string
  definition: string
}

export interface StructureFacet {
  rows: StructureRow[]
}

export interface StructureRow {
  column: string
  dataType: string
  format: string
  maxValue: string
  minValue: string
  nullAllowed: string
}

export interface AmbiguityFacet {
  rows: AmbiguityRow[]
}

export interface AmbiguityRow {
  ambiguity_risk: string
  ambiguity_type: string
  query_trigger: string
}

export interface IntentFacet {
  rows: IntentRow[]
}

export interface IntentRow {
  clarifying_question: string
  options: string
  query_trigger: string
  user_confirmed: string
  user_response: string
}

export interface ContextFacet {
  rows: ContextRow[]
}

export interface ContextRow {
  key: string
  value: string
}

export interface QueryFacet {
  rows: QueryRow[]
}

export interface QueryRow {
  timestamp_utc: string
  user_message: string
}

export interface TasksFacet {
  rows: TasksRow[]
}

export interface TasksRow {
  description: string
  formula: string
  name: string
}

export interface ScoreFacet {
  rows: ScoreRow[]
}

export interface ScoreRow {
  measure: string
  value: string
}

// Sequence items: documents and diffs with keys matching .tql format
export type SequenceItem =
  | Record<`#document[+${number}]`, TqlDocument>
  | Record<`$diff[+${number}→+${number}]`, TqlDiff>

// Conversation type (sequence of documents and diffs)
export interface TqlConversation {
  sequence: SequenceItem[]
}

// Helper functions for working with sequence
export function getDocuments(conversation: TqlConversation): TqlDocument[] {
  return conversation.sequence
    .filter((item) => Object.keys(item)[0].startsWith('#document'))
    .map((item) => Object.values(item)[0] as TqlDocument)
}

export function getLastDocument(conversation: TqlConversation): TqlDocument | undefined {
  const docs = getDocuments(conversation)
  return docs[docs.length - 1]
}

export function getDocumentCount(conversation: TqlConversation): number {
  return getDocuments(conversation).length
}

// Diff types
export type ChangeType = 'added' | 'modified' | 'removed' | 'unchanged'

export interface RowChange {
  after?: Record<string, string>
  before?: Record<string, string>
  index: number
  // For modified rows: which specific fields changed
  modifiedFields?: string[]
  type: ChangeType
}

export interface FacetDiff {
  changes: RowChange[]
  facetName: string
  rowsAfter: number
  rowsBefore: number
  status: ChangeType
}

export interface TqlDiff {
  facets: FacetDiff[]
  status: 'success' | 'table_changed'
  summary: {
    totalFacetsChanged: number
    totalFacetsUnchanged: number
    totalRowChanges: number
  }
}
