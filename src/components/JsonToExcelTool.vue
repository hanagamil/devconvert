<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPageLayout from './ToolPageLayout.vue'
import {
  findObjectArrays,
  getValueAtPath,
  type ArrayCandidate,
} from '../utils/jsonArrayUtils'
import {
  convertJsonToExcelData,
  createXlsxWorkbook,
  type ExcelCellValue,
} from '../utils/jsonToExcel'

const exampleJson = `[
  {
    "name": "Alice",
    "role": "Developer",
    "age": 29,
    "active": true,
    "profile": { "city": "Cairo", "team": "Platform" },
    "skills": ["Vue", "TypeScript"]
  },
  {
    "name": "Bob",
    "role": "Designer",
    "age": 32,
    "active": false,
    "profile": { "city": "Alexandria", "team": "Product" },
    "skills": ["Figma", "CSS"]
  }
]`

const input = ref(exampleJson)
const flattenNested = ref(true)
const error = ref('')
const notice = ref('')
const allHeaders = ref<string[]>([])
const allRows = ref<ExcelCellValue[][]>([])
const selectedColumns = ref<string[]>([])
const arrayCandidates = ref<ArrayCandidate[]>([])
const selectedArrayPath = ref('$')

const outputHeaders = computed(() => allHeaders.value.filter((header) => selectedColumns.value.includes(header)))
const outputRows = computed(() => {
  const indexes = outputHeaders.value.map((header) => allHeaders.value.indexOf(header))
  return allRows.value.map((row) => indexes.map((index) => row[index] ?? null))
})

function clearOutput() {
  allHeaders.value = []
  allRows.value = []
  selectedColumns.value = []
}

function convert() {
  error.value = ''
  notice.value = ''

  try {
    const parsed: unknown = JSON.parse(input.value)
    const candidates = findObjectArrays(parsed)
    if (candidates.length === 0) {
      throw new Error('No non-empty array of objects was found. Add an array such as data: [{ "name": "Alice" }].')
    }

    arrayCandidates.value = candidates
    if (!candidates.some((candidate) => candidate.path === selectedArrayPath.value)) {
      selectedArrayPath.value = candidates[0].path
    }

    const selectedValue = getValueAtPath(parsed, selectedArrayPath.value)
    const result = convertJsonToExcelData(selectedValue, { flattenNestedObjects: flattenNested.value })
    const previousHeaders = allHeaders.value
    const previousSelection = selectedColumns.value
    allHeaders.value = result.headers
    allRows.value = result.rows

    if (previousHeaders.length === 0) {
      selectedColumns.value = [...result.headers]
    } else {
      const stillAvailable = previousSelection.filter((column) => result.headers.includes(column))
      const newlyAdded = result.headers.filter((column) => !previousHeaders.includes(column))
      selectedColumns.value = [...stillAvailable, ...newlyAdded]
    }

    notice.value = `Ready to export ${result.rows.length} rows and ${selectedColumns.value.length} of ${result.headers.length} columns from ${selectedArrayPath.value}.`
  } catch (err) {
    clearOutput()
    arrayCandidates.value = []
    error.value = err instanceof Error ? err.message : 'Something went wrong during conversion.'
  }
}

function onArraySelectionChange() {
  clearOutput()
  convert()
}

function onColumnChange(column: string, checked: boolean) {
  selectedColumns.value = checked
    ? [...selectedColumns.value, column]
    : selectedColumns.value.filter((item) => item !== column)
  error.value = ''
  notice.value = selectedColumns.value.length
    ? `${selectedColumns.value.length} of ${allHeaders.value.length} columns selected.`
    : 'Choose at least one column to export.'
}

function toggleAllColumns(checked: boolean) {
  selectedColumns.value = checked ? [...allHeaders.value] : []
  error.value = ''
  notice.value = checked
    ? `All ${allHeaders.value.length} columns selected.`
    : 'No columns selected. Choose at least one column to export.'
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
    selectedArrayPath.value = '$'
    clearOutput()
    convert()
  }
  reader.onerror = () => {
    error.value = 'The file could not be read. Please try another file.'
  }
  reader.readAsText(file)
  target.value = ''
}

function loadExample() {
  input.value = exampleJson
  selectedArrayPath.value = '$'
  clearOutput()
  convert()
}

async function copyExcelPreview() {
  if (outputHeaders.value.length === 0) return
  const text = [
    outputHeaders.value.join('\t'),
    ...outputRows.value.map((row) => row.map((cell) => cell === null ? '' : String(cell)).join('\t')),
  ].join('\n')

  try {
    await navigator.clipboard.writeText(text)
    notice.value = 'Tab-separated preview copied. Use Download Excel for a real .xlsx workbook.'
  } catch {
    error.value = 'Clipboard access failed. Use Download Excel to save the workbook.'
  }
}

function downloadExcel() {
  if (outputHeaders.value.length === 0) {
    error.value = 'Choose at least one column before downloading.'
    return
  }

  try {
    const workbook = createXlsxWorkbook(outputHeaders.value, outputRows.value)
    const buffer = workbook.slice().buffer as ArrayBuffer
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'converted.xlsx'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = `Excel workbook created with ${outputRows.value.length} rows and ${outputHeaders.value.length} columns.`
    error.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'The Excel workbook could not be created.'
  }
}

function displayCell(value: ExcelCellValue): string {
  if (value === null) return ''
  return String(value)
}

convert()
</script>

<template>
  <ToolPageLayout active-tool="excel">
    <section class="hero">
      <p class="eyebrow">FREE ONLINE DEVELOPER TOOL</p>
      <h1>JSON to Excel Converter</h1>
      <p class="hero-copy">
        Convert JSON arrays and API responses into a real Excel workbook (.xlsx). Preview your data,
        choose the columns you need, and download it — your JSON stays on your device.
      </p>
    </section>

    <section class="workspace" aria-label="JSON to Excel converter">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <h2>Input JSON</h2>
            <p>Paste JSON or upload a file. Arrays of objects are detected automatically.</p>
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
          <label for="excel-array-path">Array to convert</label>
          <select id="excel-array-path" v-model="selectedArrayPath" @change="onArraySelectionChange">
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
        </div>

        <section v-if="allHeaders.length" class="column-picker" aria-label="Choose Excel columns">
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
          <button class="primary-button" type="button" @click="convert">Convert to Excel</button>
          <button class="secondary-button" type="button" @click="loadExample">Load example</button>
        </div>
      </div>

      <div class="panel output-panel">
        <div class="panel-heading">
          <div>
            <h2>Excel preview</h2>
            <p>Check the data before downloading your workbook.</p>
          </div>
          <span v-if="allHeaders.length" class="result-count">{{ allRows.length }} rows</span>
        </div>

        <div v-if="error" class="message error-message" role="alert">{{ error }}</div>
        <div v-else-if="notice" class="message success-message" role="status">{{ notice }}</div>

        <div v-if="outputHeaders.length" class="table-wrap">
          <table>
            <thead>
              <tr><th v-for="header in outputHeaders" :key="header">{{ header }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in outputRows.slice(0, 8)" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ displayCell(cell) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="outputRows.length > 8" class="preview-note">Showing the first 8 rows. Download for the complete workbook.</p>
          <p class="preview-note">Numbers and booleans remain typed values in Excel. Nested arrays are stored as JSON text in a cell.</p>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">↳</span>
          <strong>Your Excel preview will appear here</strong>
          <span>Enter valid JSON and select “Convert to Excel”.</span>
        </div>

        <div class="actions output-actions">
          <button class="primary-button" type="button" :disabled="!outputHeaders.length" @click="downloadExcel">
            Download Excel (.xlsx)
          </button>
          <button class="secondary-button" type="button" :disabled="!outputHeaders.length" @click="copyExcelPreview">
            Copy preview
          </button>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2>How to convert JSON to Excel</h2>
      <ol>
        <li>Paste your JSON or upload a <code>.json</code> file. The tool finds arrays of objects, including arrays nested in API responses.</li>
        <li>Choose which columns to include and whether to flatten nested objects into columns such as <code>profile.city</code>.</li>
        <li>Preview the data, then select <strong>Download Excel (.xlsx)</strong> to save a workbook that opens in Microsoft Excel and compatible spreadsheet apps.</li>
      </ol>
      <div class="privacy-note">
        <strong>Private, browser-based conversion</strong>
        <p>Your JSON is processed locally in your browser. String values are written as text cells rather than formulas.</p>
      </div>
    </section>

    <section id="faq" class="info-section" aria-labelledby="faq-title">
      <h2 id="faq-title">Frequently asked questions</h2>
      <details>
        <summary>How do I convert JSON to Excel?</summary>
        <p>Paste JSON or upload a JSON file, choose the array and columns, then download the resulting .xlsx workbook.</p>
      </details>
      <details>
        <summary>Does this download a real Excel file or a CSV file?</summary>
        <p>It creates an .xlsx workbook. The workbook contains a Data worksheet with a header row, frozen headers, and an autofilter for the exported columns.</p>
      </details>
      <details>
        <summary>Can I convert nested JSON or API responses?</summary>
        <p>Yes. You can select a nested array of objects from an API response and flatten nested object properties into dotted column names.</p>
      </details>
      <details>
        <summary>Is my JSON uploaded to a server?</summary>
        <p>No. Parsing and workbook generation run locally in your browser; the tool does not send the JSON to a conversion server.</p>
      </details>
      <details>
        <summary>Are strings beginning with an equals sign treated as formulas?</summary>
        <p>No. String values are explicitly encoded as text cells in the workbook, so they are not interpreted as spreadsheet formulas.</p>
      </details>
    </section>

    <section id="related-tools" class="info-section related-tools">
      <h2>More free developer tools</h2>
      <p>Working with JSON data? You can also <a href="/">convert JSON to CSV</a> to export selected fields to a lightweight, spreadsheet-friendly text file.</p>
    </section>

  </ToolPageLayout>
</template>
