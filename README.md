# TrustQuery Trace

> **Trace data disambiguation conversations with versioned semantic annotations**

## What is TrustQuery Trace?

Like LangSmith traces LLM conversations, **TrustQuery traces data disambiguation**.

When users work with datasets, ambiguity creates risk. "Yesterday" depends on timezone. "Sales" could mean revenue, units, or subscriptions. TrustQuery Trace captures the conversation of how ambiguous data becomes clear - with full version history.

The `.tql` format is a traced conversation that Systems, Users, and LLMs can share for precise understanding. Each `TqlConversation` logs the evolution of data semantics over time, like git commits for data understanding.

For any given dataset part of a conversation, a .tql file has:
- @data: The dataset
- @meaning: A list of the column names so that each column's definition can be explicitly stated for the user to confirm.
- @structure: A list of column names so any constraints or validating properties of columns can be shown and/or confirmed by the user.
- @context: Information about the conversation, such as the User's timezone, system timezone, etc.
- @ambiguity: A list of possible issues in a query or data, that a System can deterministically parse, or LLM can pre-fill.
- @intent: Any questions a System or LLM can ask a user in order to better understand the user's intent.
- @query: A log of queries asked against this dataset, with user and timestamp.
- @tasks: Computational tasks that can be performed on the data with formulas.
- @score: Calculations of the range of possible answers based on remaining ambiguity.

By standardizing the approach of calibrating mutual understanding, this format can be distributed, and can create "memory" for systems, so that when someone else encounters the same dataset, some of the column names, etc., can be disambiguated, and over time, from a bottoms-up-approach data is cleaned, conflicts are surfaced, and recommendations may be made.

When a user answers a question, the working .tql document can be updated.

The TrustQuery Trace library (`@trustquery/trace`) gives developers tools to create .tql files, parse them, update them with diffs, and convert between formats.

## The Problem TrustQuery Trace Solves

When someone asks "How much money was transferred yesterday?", there are multiple valid interpretations:
- Which timezone defines "yesterday"?
- Are amounts in dollars or thousands of dollars?
- Does "transferred" mean sent, received, or both?

**TrustQuery Trace makes ambiguity explicit, resolvable, and traceable over time.**

## File Structure

A `.tql` file contains 9 sections:

### 1. `@table`
The actual tabular data (CSV-style or table format)

```
@table:
| transfer_id  | timestamp            | amount_usd | status    |
|--------------|----------------------|------------|-----------|
| TXN-2024-001 | 2024-11-04T08:15:23Z | 250000     | completed |
| TXN-2024-002 | 2024-11-04T14:42:11Z | 500000     | completed |
...
```

### 2. `@meaning`
Business definitions for each column
- What does this column represent?
- Has the user confirmed this definition?

```
@meaning:
| column               | definition                                              |
|----------------------|---------------------------------------------------------|
| transfer_id          | Unique identifier for each stablecoin transfer          |
| timestamp            | ISO 8601 format with timezone                           |
| amount_usd           | Transfer value in US Dollars, scaled in thousands       |
| status               | Current state of the transfer transaction               |
```

### 3. `@structure`
Technical constraints (inspired by JSON Schema)
- Data types, null handling, formats, min/max values
- Has the user confirmed these constraints?

```
@structure:
| column      | nullAllowed | dataType | minValue | maxValue | format                        |
|-------------|-------------|----------|----------|----------|-------------------------------|
| transfer_id | false       | string   | -        | -        |                               |
| timestamp   | false       | datetime | -        | -        | ISO8601+TZ                    |
| amount_usd  | false       | decimal  | 0        | -        | -                             |
| status      | false       | enum     | -        | -        | completed|pending|failed     |
```

### 4. `@context`
Query execution context
- Current user, timezone, date/time
- Any other relevant environmental info

```
@context:
| key                  | value                         |
|----------------------|-------------------------------|
| user                 | jon@citi.com                  |
| user_timezone        | America/New_York              |
| current_time_utc     | 2024-11-05T23:00:00Z          |
| current_time_local   | 2024-11-05T18:00:00-05:00     |
```

### 5. `@ambiguity`
Known ambiguities that affect queries
- What triggers the ambiguity (e.g., "yesterday", "profit")
- What type of ambiguity (temporal, directional, scope)
- What's at risk if not resolved

```
@ambiguity:
| query_trigger | ambiguity_type       | ambiguity_risk                              |
|---------------|----------------------|---------------------------------------------|
| yesterday     | temporal_perspective | user's timezone vs UTC (data timezone)      |
| amount_usd    | unit_scale           | User may be unaware units are in thousands  |
```

### 6. `@intent`
Pre-defined clarifying questions
- The question to ask the user
- Available options
- Space to record user responses

```
@intent:
| query_trigger | clarifying_question                            | options                                   | user_response | user_confirmed |
|---------------|------------------------------------------------|-------------------------------------------|---------------|----------------|
| yesterday     | Which timezone should I use to define 'yesterday'? | [Your timezone (EST), UTC]            |               |                |
| amount_usd    | The amounts are in thousands. Show as-is or converted? | [Show as-is (250), Convert to dollars ($250,000)] | | |
```

### 7. `@score`
A standard way to score the precision of the query and data
- range-values: What is the range, min to max in values, for example $50,000 to $3,500,000
- number-of-interpretations: If there are 4 answers, such as $50,000 |  $95,000 | $1,125,0000 | $3,500,000 that are valid based on unresolved ambiguity
- Uncertainty Ratio: How wide the range is relative to the average. Formula: (max - min) / mean. Higher values indicate greater uncertainty
- Missing Certainty Ratio: The percentage reduction in uncertainty achieved by answering the most valuable clarifying question. A value of 1.00 (100%) means this question eliminates all uncertainty


```
@score:
| measure                   | value |
|---------------------------|-------|
| range-values              |       |
| number-of-interpretations |       |
| Uncertainty Ratio (UR)    |       |
| Missing Certainty Ratio   |       |
```

### 8. `@query`
Query history log
- The message/query text from the user
- When it was asked (ISO 8601 UTC timestamp)

```
@query:
| user_message                                    | timestamp_utc        |
|-------------------------------------------------|----------------------|
| How much was transferred yesterday?             | 2024-11-05T23:15:42Z |
| What's the average settlement time?             | 2024-11-05T23:20:11Z |
```

### 9. `@tasks`
Computational tasks that can be performed on the data
- Task name
- Description of what it calculates
- Formula or expression to compute it

```
@tasks:
| name              | description                           | formula                                    |
|-------------------|---------------------------------------|--------------------------------------------|
| total_transferred | Sum of all completed transfers        | SUM(amount_usd WHERE status='completed')   |
| avg_settlement    | Average settlement time in minutes    | AVG(settlement_time_mins)                  |
```

---

## Referencing Scheme

TQL uses a structured referencing syntax to address specific elements within documents and across files.

### Syntax Structure

```
#document[N].@facet[N].column_name
```

### Components

- **document**: `#document[N]` - Document version within file (0-based)
- **facet**: `@table | @meaning | @structure | @context | @query | @tasks | @score | @ambiguity | @intent`
- **row**: `[N]` - Row index within facet (0-based)
- **column**: Column name from the facet table

### Examples

**Within a single .tql file:**
```
#document[0].@table[10].amount_usd       # "amount_usd" column, row 10 (11th row)
#document[1].@meaning[1].definition      # "definition" column, row 1 (2nd row)
#document[2].@context[0].user_timezone   # "user_timezone" column, row 0 (1st row)
```

**Across multiple files (graph references):**
```
acme-session-123.tql#document[0].@table[5].transfer_id
techcorp-session-456.tql#document[1].@meaning[2].definition
```

### Diff References

Diffs track changes between document versions:

```
$diff(0,1).@context[0]    # change in row 0 of @context between docs 0 and 1
$diff(1,2).@meaning[3]    # change in row 3 of @meaning between docs 1 and 2
```

**Note**: All indexing is 0-based (developer-friendly) for programmatic access.

---

## Installation

### CLI (Global)

```bash
npm install -g @trustquery/trace
```

### Library (Node.js & Browser)

```bash
npm install @trustquery/trace
```

## Usage

### CLI

Create a TQL file from a CSV data source:

```bash
tql create --source csv --in examples/stablecoin.csv --out output.tql
```

This generates a TQL conversation with 9 facets: @table, @meaning, @structure, @ambiguity, @intent, @context, @query, @tasks, @score

### As a Library (Node.js)

```typescript
import {
  readCsv,
  generateTqlDocument,
  insertRowInMemory,
  applyChangesToConversation
} from '@trustquery/trace'

// Read CSV and generate TQL
const csvData = readCsv('data.csv')
const tqlDoc = generateTqlDocument({
  source: { format: 'csv', data: csvData },
  facet: { name: '@table' }
})

// Add metadata with automatic diff tracking
const conversation = applyChangesToConversation(
  { sequence: [{ '#document[+0]': tqlDoc }] },
  (doc) => {
    insertRowInMemory(doc, 'context', {
      key: 'source',
      value: 'internal-api'
    })
  }
)

// conversation.sequence now has:
// [0] #document[0] - original
// [1] $diff(0,1) - what changed
// [2] #document[1] - with changes
```

### As a Library (Browser/Chrome Extension)

```typescript
import {
  parseCsvString,  // Browser-compatible!
  generateTqlDocument
} from '@trustquery/trace'

// Parse CSV string (no fs dependency)
const csvData = parseCsvString(csvString)
const tqlDoc = generateTqlDocument({
  source: { format: 'csv', data: csvData },
  facet: { name: '@table' }
})
```

See [BROWSER_USAGE.md](./BROWSER_USAGE.md) for full browser/Chrome extension guide.

## Local Development

```bash
git clone https://github.com/RonItelman/trustquery-trace.git
cd trustquery-trace
npm install
npm run build
npm link
```

Then use the CLI:

```bash
tql create --source csv --in examples/stablecoin.csv
```

## Conclusion

### Key Features

Each section serves a specific purpose in the disambiguation process:
- **@data** - What we have (raw information)
- **@meaning** - What it means (business semantics)
- **@structure** - How it's validated (technical constraints)
- **@context** - When/where we're asking (situational awareness)
- **@ambiguity** - What's unclear (risk identification)
- **@intent** - What to ask (clarification pathway)
- **@query** - Who asked what and when (query audit trail)
- **@tasks** - What computations to perform (calculable metrics)
- **@score** - How uncertain we are (quantified risk)

Together, these sections create a complete picture of both the data and the uncertainty around it.


### Use Cases

**For Analysts:** Answer "what does this column mean?" once, benefit forever  
**For Auditors:** See all possible interpretations and their risk levels before signing off  
**For Teams:** Build shared understanding of datasets through collaborative disambiguation  
**For Systems:** Automatically detect and flag ambiguous queries before executing them
