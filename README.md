# JSON to CSV Converter

A Vue 3 + TypeScript + Vite starter for a browser-based JSON-to-CSV tool.

## Requirements
- Node.js 20.19+ or 22.12+ recommended for current Vite 6 releases.

## Run locally
```bash
npm install
npm run dev
```

## Validate the project
```bash
npm run type-check
npm test
npm run build
```

## Privacy
The conversion function runs in the browser. The starter does not send input JSON to a conversion API.

## Current conversion behavior
- Detects non-empty arrays of objects at the top level or nested in API response objects; select the array when multiple candidates are found.
- Nested objects flatten to dot-separated columns by default.
- Arrays remain JSON text inside a single CSV cell.
- Columns are collected in first-seen order; missing values become empty cells.
- CSV quoting follows common CSV escaping rules.
- Spreadsheet formula protection is a mitigation for common dangerous string prefixes, not a guarantee across every spreadsheet application.


### Column selection

After conversion, use the simple column checklist to include only the fields you need. Select or deselect all columns at once. The CSV preview and download reflect the selected columns.
