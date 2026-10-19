<script setup lang="ts">
import { ref } from 'vue'
import { convertJsonToCsv, findObjectArrays, getValueAtPath, type ArrayCandidate } from './utils/jsonToCsv'

const exampleJson = `[
  {
    "name": "Alice",
    "role": "Developer",
    "profile": { "city": "Cairo" }
  },
  {
    "name": "Bob",
    "role": "Designer",
    "profile": { "city": "Alexandria" },
    "active": true
  }
]`

const input = ref(exampleJson)
const delimiter = ref<',' | ';' | '\t'>(',')
const flattenNested = ref(true)
const protectFormulas = ref(true)
const error = ref('')
const notice = ref('')
const csvOutput = ref('')
const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const allHeaders = ref<string[]>([])
const selectedColumns = ref<string[]>([])
const allRows = ref<string[][]>([])
const arrayCandidates = ref<ArrayCandidate[]>([])
const selectedArrayPath = ref('$')

function convert() {
  error.value = ''
  notice.value = ''

  try {
    const parsed: unknown = JSON.parse(input.value)
    arrayCandidates.value = findObjectArrays(parsed)

    if (arrayCandidates.value.length === 0) {
      throw new Error(
        'No non-empty array of objects was found. Add an array such as data: [{ "name": "Alice" }].',
      )
    }

    const selectedStillExists = arrayCandidates.value.some(
      (candidate) => candidate.path === selectedArrayPath.value,
    )
    if (!selectedStillExists) {
      selectedArrayPath.value = arrayCandidates.value[0].path
    }

    const selectedValue = getValueAtPath(parsed, selectedArrayPath.value)
    const options = {
      delimiter: delimiter.value,
      flattenNestedObjects: flattenNested.value,
      protectSpreadsheetFormulas: protectFormulas.value,
    }
    const fullResult = convertJsonToCsv(selectedValue, options)
    const previousHeaders = allHeaders.value
    const previousSelection = selectedColumns.value

    allHeaders.value = fullResult.headers
    allRows.value = fullResult.rows

    // Select every column on the first conversion. On later conversions, preserve
    // the user's choices and automatically include newly discovered columns.
    if (previousHeaders.length === 0) {
      selectedColumns.value = [...fullResult.headers]
    } else {
      const stillAvailable = previousSelection.filter((column) => fullResult.headers.includes(column))
      const newlyAdded = fullResult.headers.filter((column) => !previousHeaders.includes(column))
      selectedColumns.value = [...stillAvailable, ...newlyAdded]
    }

    updateSelectedOutput()
    if (selectedColumns.value.length > 0) {
      notice.value = `Converted ${fullResult.rows.length} rows with ${selectedColumns.value.length} of ${fullResult.headers.length} columns from ${selectedArrayPath.value}.`
    } else {
      notice.value = 'Choose at least one column to create your CSV.'
    }
  } catch (err) {
    csvOutput.value = ''
    headers.value = []
    rows.value = []
    allHeaders.value = []
    allRows.value = []
    selectedColumns.value = []
    arrayCandidates.value = []
    error.value = err instanceof Error ? err.message : 'Something went wrong during conversion.'
  }
}

function updateSelectedOutput() {
  const selected = new Set(selectedColumns.value)
  headers.value = allHeaders.value.filter((header) => selected.has(header))
  const indexes = headers.value.map((header) => allHeaders.value.indexOf(header))
  rows.value = allRows.value.map((row) => indexes.map((index) => row[index]))

  if (headers.value.length === 0) {
    csvOutput.value = ''
    return
  }

  // Reuse the converter's CSV escaping and delimiter behavior for selected columns.
  try {
    const parsed: unknown = JSON.parse(input.value)
    const selectedValue = getValueAtPath(parsed, selectedArrayPath.value)
    const result = convertJsonToCsv(selectedValue, {
      delimiter: delimiter.value,
      flattenNestedObjects: flattenNested.value,
      protectSpreadsheetFormulas: protectFormulas.value,
      selectedColumns: headers.value,
    })
    csvOutput.value = result.csv
  } catch {
    csvOutput.value = ''
  }
}

function toggleAllColumns(checked: boolean) {
  selectedColumns.value = checked ? [...allHeaders.value] : []
  updateSelectedOutput()
  notice.value = checked
    ? `All ${allHeaders.value.length} columns selected.`
    : 'No columns selected. Choose at least one column to create your CSV.'
  error.value = ''
}

function onColumnChange(column: string, checked: boolean) {
  selectedColumns.value = checked
    ? [...selectedColumns.value, column]
    : selectedColumns.value.filter((item) => item !== column)
  updateSelectedOutput()
  notice.value = selectedColumns.value.length
    ? `${selectedColumns.value.length} of ${allHeaders.value.length} columns selected.`
    : 'Choose at least one column to create your CSV.'
  error.value = ''
}

function onArraySelectionChange() {
  // Reset the column selection when switching to a different array.
  allHeaders.value = []
  selectedColumns.value = []
  convert()
}

function loadFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.json')) {
    error.value = 'Please choose a .json file.'
    target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    input.value = String(reader.result ?? '')
    convert()
  }
  reader.onerror = () => {
    error.value = 'The file could not be read. Please try another file.'
  }
  reader.readAsText(file)
  target.value = ''
}

async function copyCsv() {
  if (!csvOutput.value) return
  try {
    await navigator.clipboard.writeText(csvOutput.value)
    notice.value = 'CSV copied to clipboard.'
  } catch {
    error.value = 'Clipboard access failed. Select and copy the CSV preview instead.'
  }
}

function downloadCsv() {
  if (!csvOutput.value) return
  const blob = new Blob(['\uFEFF', csvOutput.value], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'converted.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function resetExample() {
  input.value = exampleJson
  convert()
}

convert()
</script>

<template>
  <main class="page-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="JSON to CSV Converter home">
        <span class="brand-mark">{ }</span>
        <span>DevConvert</span>
      </a>
      <span class="privacy-pill"><span class="privacy-dot"></span> Runs in your browser</span>
    </header>

    <section class="hero">
      <p class="eyebrow">FREE DEVELOPER TOOL</p>
      <h1>JSON to CSV Converter</h1>
      <p class="hero-copy">
        Convert JSON data into spreadsheet-ready CSV. Preview your results and download them
        instantly — your data stays on your device.
      </p>
    </section>

    <section class="workspace" aria-label="JSON to CSV converter">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <h2>Input JSON</h2>
            <p>Paste JSON or upload a file. We'll find arrays of objects automatically.</p>
          </div>
          <label class="upload-button">
            <span>Upload file</span>
            <input type="file" accept=".json,application/json" @change="loadFile" />
          </label>
        </div>
        <textarea
          v-model="input"
          class="code-input"
          aria-label="Input JSON"
          spellcheck="false"
          placeholder='[{"name":"Alice","role":"Developer"}]'
        ></textarea>

        <div v-if="arrayCandidates.length > 1" class="array-selector">
          <label for="array-path">Array to convert</label>
          <select id="array-path" v-model="selectedArrayPath" @change="onArraySelectionChange">
            <option v-for="candidate in arrayCandidates" :key="candidate.path" :value="candidate.path">
              {{ candidate.path }} ({{ candidate.value.length }} rows)
            </option>
          </select>
        </div>
        <p v-else-if="arrayCandidates.length === 1 && arrayCandidates[0].path !== '$'" class="detected-path">
          Detected array: <code>{{ arrayCandidates[0].path }}</code>
        </p>

        <div class="options">
          <label class="option">
            <input v-model="flattenNested" type="checkbox" @change="convert" />
            <span>Flatten nested objects</span>
          </label>
          <label class="option">
            <input v-model="protectFormulas" type="checkbox" @change="convert" />
            <span>Protect spreadsheet formulas</span>
          </label>
          <label class="delimiter-control">
            <span>Delimiter</span>
            <select v-model="delimiter" @change="convert" aria-label="CSV delimiter">
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option :value="'\t'">Tab</option>
            </select>
          </label>
        </div>

        <section v-if="allHeaders.length" class="column-picker" aria-label="Choose CSV columns">
          <div class="column-picker-heading">
            <div>
              <h3>Columns to include</h3>
              <p>{{ selectedColumns.length }} of {{ allHeaders.length }} selected</p>
            </div>
            <label class="select-all-option">
              <input
                type="checkbox"
                :checked="selectedColumns.length === allHeaders.length"
                :indeterminate="selectedColumns.length > 0 && selectedColumns.length < allHeaders.length"
                @change="toggleAllColumns(($event.target as HTMLInputElement).checked)"
              />
              <span>Select all</span>
            </label>
          </div>
          <div class="column-list">
            <label v-for="header in allHeaders" :key="header" class="column-option">
              <input
                type="checkbox"
                :checked="selectedColumns.includes(header)"
                @change="onColumnChange(header, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ header }}</span>
            </label>
          </div>
        </section>

        <div class="actions">
          <button class="primary-button" type="button" @click="convert">Convert to CSV</button>
          <button class="secondary-button" type="button" @click="resetExample">Load example</button>
        </div>
      </div>

      <div class="panel output-panel">
        <div class="panel-heading">
          <div>
            <h2>CSV output</h2>
            <p>Review the result before copying or downloading.</p>
          </div>
          <span v-if="csvOutput" class="result-count">{{ rows.length }} rows</span>
        </div>

        <div v-if="error" class="message error-message" role="alert">{{ error }}</div>
        <div v-else-if="notice" class="message success-message" role="status">{{ notice }}</div>

        <div v-if="csvOutput" class="table-wrap">
          <table>
            <thead>
              <tr><th v-for="header in headers" :key="header">{{ header }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in rows.slice(0, 8)" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="rows.length > 8" class="preview-note">Showing the first 8 rows. Download for the full result.</p>
          <label class="csv-label" for="csv-output">CSV text</label>
          <textarea id="csv-output" class="csv-output" :value="csvOutput" readonly spellcheck="false"></textarea>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">↳</span>
          <strong>Your CSV will appear here</strong>
          <span>Enter valid JSON and select “Convert to CSV”.</span>
        </div>

        <div class="actions output-actions">
          <button class="primary-button" type="button" :disabled="!csvOutput" @click="downloadCsv">
            Download CSV
          </button>
          <button class="secondary-button" type="button" :disabled="!csvOutput" @click="copyCsv">
            Copy CSV
          </button>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2>How to convert JSON to CSV</h2>
      <ol>
        <li>Paste JSON or upload a <code>.json</code> file. Arrays of objects are detected automatically, including nested API arrays.</li>
        <li>Choose whether to flatten nested objects and select a delimiter.</li>
        <li>Convert, review the preview, then copy or download the CSV file.</li>
      </ol>
      <div class="privacy-note">
        <strong>Privacy by design</strong>
        <p>This starter converts data locally in your browser. It does not send the JSON input to a conversion server.</p>
      </div>
    </section>

    <section id="faq" class="info-section" aria-labelledby="faq-title">
      <h2 id="faq-title">Frequently asked questions</h2>

      <details>
        <summary>How do I convert JSON to CSV?</summary>
        <p>Paste your JSON or load a JSON file, choose the columns and delimiter you need, then convert and copy or download the CSV.</p>
      </details>

      <details>
        <summary>Can I convert nested JSON or API responses?</summary>
        <p>Yes. DevConvert can detect arrays of objects inside an API response. Choose the array you want to convert, and enable nested-object flattening to create columns such as <code>profile.city</code>.</p>
      </details>

      <details>
        <summary>Is my JSON data uploaded to a server?</summary>
        <p>No. Conversion runs locally in your browser. The JSON you enter is processed on your device and is not sent to a DevConvert conversion server.</p>
      </details>

      <details>
        <summary>Can I choose which fields become CSV columns?</summary>
        <p>Yes. Use the column checklist to select the fields you want. The preview and exported CSV will reflect your selection.</p>
      </details>

      <details>
        <summary>How are arrays inside objects handled?</summary>
        <p>Array values stay in a single CSV cell as JSON instead of being expanded into multiple rows.</p>
      </details>
    </section>

    <section id="about" class="info-section">
      <h2>About DevConvert</h2>
      <p>
        DevConvert provides simple browser-based tools for everyday developer workflows.
        Our first tool converts JSON arrays into CSV so developers can review data, select
        columns, and export results without needing a separate application.
      </p>
    </section>

    <section id="privacy" class="info-section">
      <h2>Privacy Policy</h2>
      <p>
        The JSON-to-CSV conversion in this tool runs locally in your browser. The JSON you
        enter or upload is processed on your device and is not sent to a DevConvert conversion
        server. If you choose to copy or download the result, that action is handled by your
        browser.
      </p>
      <p>
        This website may use hosting-provider infrastructure to deliver the page. If analytics,
        advertising, or other third-party services are added in the future, this policy should
        be updated to explain what data those services collect and how they use it.
      </p>
      <p>Contact: add a public contact email here before launch marketing or advertising.</p>
    </section>

    <footer class="site-footer">
      <span>DevConvert</span>
      <span>Simple tools for everyday developer workflows.</span>
      <nav aria-label="Footer">
        <a href="#about">About</a>
        <a href="#privacy">Privacy Policy</a>
      </nav>
    </footer>
  </main>
</template>