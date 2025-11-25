import {expect} from 'chai'
import * as fs from 'node:fs'
import * as path from 'node:path'

import type {TqlConversation, TqlDocument} from '../../dist/index.js'
import {
  applyChangesToConversation,
  deleteRowInMemory,
  generateTqlDocument,
  insertRowInMemory,
  parseTqlConversationFromString,
  readCsv,
  updateRowInMemory,
  writeTql,
} from '../../dist/index.js'

describe('Comprehensive TQL Test - All Facets', () => {
  const testOutputPath = path.join(process.cwd(), 'test-comprehensive-output.tql')

  it('should create TQL file and track changes to all 9 facets', () => {
    // Step 1: Read CSV and generate initial TQL document
    const csvPath = path.join(process.cwd(), 'examples', 'stablecoin.csv')
    const csvData = readCsv(csvPath)

    const tqlDoc = generateTqlDocument({
      facet: {name: '@table'},
      source: {data: csvData, format: 'csv'},
    })

    let conversation: TqlConversation = {
      sequence: [{'#document[+0]': tqlDoc}],
    }

    // Step 2: Make changes to semantic facets (8 facets)
    // Note: @table is the source data and should remain unchanged for diff tracking

    // 1. @meaning - Insert definition
    conversation = applyChangesToConversation(conversation, (doc) => {
      updateRowInMemory(doc, 'meaning', 0, {
        column: 'transfer_id',
        definition: 'Unique identifier for each stablecoin transfer',
      })
    })

    // 2. @structure - Add constraint
    conversation = applyChangesToConversation(conversation, (doc) => {
      updateRowInMemory(doc, 'structure', 0, {
        column: 'transfer_id',
        dataType: 'string',
        format: 'TXN-YYYY-NNN',
        maxValue: '',
        minValue: '',
        nullAllowed: 'false',
      })
    })

    // 3. @ambiguity - Insert ambiguity
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'ambiguity', {
        ambiguity_risk: "user's timezone vs UTC",
        ambiguity_type: 'temporal_perspective',
        query_trigger: 'yesterday',
      })
    })

    // 4. @intent - Insert clarifying question
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'intent', {
        clarifying_question: "Which timezone should I use to define 'yesterday'?",
        options: '[Your timezone (EST), UTC]',
        query_trigger: 'yesterday',
        user_confirmed: '',
        user_response: '',
      })
    })

    // 5. @context - Add user context
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'context', {
        key: 'user',
        value: 'analyst@acme.com',
      })
      insertRowInMemory(doc, 'context', {
        key: 'timezone',
        value: 'America/New_York',
      })
    })

    // 6. @query - Add user query
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'query', {
        timestamp_utc: '2024-11-05T18:30:00Z',
        user_message: 'How much was transferred yesterday?',
      })
    })

    // 7. @tasks - Add computational task
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'tasks', {
        description: 'Sum of all completed transfers',
        formula: "SUM(amount_usd WHERE status='completed')",
        name: 'total_transferred',
      })
    })

    // 8. @score - Update uncertainty score
    conversation = applyChangesToConversation(conversation, (doc) => {
      updateRowInMemory(doc, 'score', 0, {
        measure: 'range-values',
        value: '$50,000 to $3,500,000',
      })
    })

    // Step 3: Add another context entry (to test multiple changes to same facet)
    conversation = applyChangesToConversation(conversation, (doc) => {
      insertRowInMemory(doc, 'context', {
        key: 'current_time_utc',
        value: '2024-11-05T23:00:00Z',
      })
    })

    // Step 4: Write conversation to file
    writeTql(testOutputPath, conversation)

    // Step 5: Verify file was created
    expect(fs.existsSync(testOutputPath)).to.be.true

    // Step 6: Parse the file back and verify structure
    const parsedConversation = parseTqlConversationFromString(fs.readFileSync(testOutputPath, 'utf8'))

    // Verify we have multiple documents (original + changes)
    expect(parsedConversation.sequence.length).to.be.greaterThan(1)

    // Verify we have both documents and diffs
    const documentKeys = parsedConversation.sequence.filter((item) => Object.keys(item)[0].startsWith('#document'))
    const diffKeys = parsedConversation.sequence.filter((item) => Object.keys(item)[0].startsWith('$diff'))

    expect(documentKeys.length).to.be.greaterThan(1) // Multiple documents
    expect(diffKeys.length).to.be.greaterThan(0) // At least one diff

    // Step 7: Verify specific changes in the conversation

    // Get the last document
    const lastItem = parsedConversation.sequence.at(-1)! as any
    const lastDocKey = Object.keys(lastItem)[0]
    const lastDoc = lastItem[lastDocKey] as TqlDocument

    // Verify @table remains unchanged (source data is immutable in diff tracking)
    expect(lastDoc.table.rows.length).to.equal(25) // Originally 25 rows

    // Verify @meaning has definition
    const meaningRow = lastDoc.meaning.rows.find((r: any) => r.column === 'transfer_id')
    expect(meaningRow?.definition).to.equal('Unique identifier for each stablecoin transfer')

    // Verify @structure has constraint
    const structureRow = lastDoc.structure.rows.find((r: any) => r.column === 'transfer_id')
    expect(structureRow?.dataType).to.equal('string')
    expect(structureRow?.format).to.equal('TXN-YYYY-NNN')

    // Verify @ambiguity has entry
    expect(lastDoc.ambiguity.rows.length).to.be.greaterThan(0)
    expect(lastDoc.ambiguity.rows[0].query_trigger).to.equal('yesterday')

    // Verify @intent has entry
    expect(lastDoc.intent.rows.length).to.be.greaterThan(0)
    expect(lastDoc.intent.rows[0].query_trigger).to.equal('yesterday')

    // Verify @context has entries (user, timezone, current_time_utc)
    expect(lastDoc.context.rows.length).to.equal(3)
    const userContext = lastDoc.context.rows.find((r: any) => r.key === 'user')
    expect(userContext?.value).to.equal('analyst@acme.com')

    // Verify @query has entry
    expect(lastDoc.query.rows.length).to.equal(1)
    expect(lastDoc.query.rows[0].user_message).to.equal('How much was transferred yesterday?')

    // Verify @tasks has entry
    expect(lastDoc.tasks.rows.length).to.be.greaterThan(0)
    expect(lastDoc.tasks.rows[0].name).to.equal('total_transferred')

    // Verify @score has updated value
    const rangeScore = lastDoc.score.rows.find((r: any) => r.measure === 'range-values')
    expect(rangeScore?.value).to.equal('$50,000 to $3,500,000')

    // Step 8: Verify diffs are present in the file content
    const fileContent = fs.readFileSync(testOutputPath, 'utf8')

    // Check for diff markers
    expect(fileContent).to.include('$diff(')
    expect(fileContent).to.include('@table:')
    expect(fileContent).to.include('@meaning:')
    expect(fileContent).to.include('@structure:')
    expect(fileContent).to.include('@ambiguity:')
    expect(fileContent).to.include('@intent:')
    expect(fileContent).to.include('@context:')
    expect(fileContent).to.include('@query:')
    expect(fileContent).to.include('@tasks:')
    expect(fileContent).to.include('@score:')

    // Check for delta markers in diffs
    expect(fileContent).to.match(/\| Δ\s+\|/) // Delta column in diff tables
    expect(fileContent).to.match(/\| \+\s+\|/) // Addition marker

    console.log('✓ All 8 semantic facets modified successfully')
    console.log('✓ All changes tracked in diffs')
    console.log('✓ File structure validated')
    console.log('✓ @table (source data) remains unchanged as expected')
    console.log(`✓ Output written to: ${testOutputPath}`)
  })
})
