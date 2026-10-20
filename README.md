# DevConvert

DevConvert is a Vue 3, TypeScript, and Vite website with separate browser-based data conversion tools.

## Requirements

- Node.js 20.19+ or 22.12+ recommended for Vite 6.

## Run locally

```bash
npm ci
npm run dev
```

Vite prints a local URL. The JSON-to-CSV tool is served from `/`, and JSON-to-Excel is served from `/json-to-excel.html`.

## Validate the project

```bash
npm run type-check
npm test
npm run build
```

## Available tools

- `/` — JSON to CSV, including JSON array discovery, optional nested-object flattening, column selection, preview, and download.
- `/json-to-excel.html` — JSON to Excel, exporting a real `.xlsx` workbook with typed number/boolean cells, column selection, frozen header row, and worksheet autofilter.

Both tools process the input locally in the browser; the project does not send JSON input to a conversion API. CSV formula-prefix protection is a mitigation for common dangerous prefixes, not a guarantee across every spreadsheet application. Excel string cells are written as text rather than formulas.

## Project structure

- `index.html` — SEO metadata and HTML shell for the JSON-to-CSV page.
- `json-to-excel.html` — SEO metadata and HTML shell for the JSON-to-Excel page.
- `src/main-json-to-csv.ts` — mounts the JSON-to-CSV Vue component and global styles.
- `src/main-json-to-excel.ts` — mounts the JSON-to-Excel Vue component and global styles.
- `src/components/JsonToCsvTool.vue` — JSON-to-CSV interface and UI state.
- `src/components/JsonToExcelTool.vue` — JSON-to-Excel interface and UI state.
- `src/components/ToolPageLayout.vue` — shared header, tool navigation, footer, and page shell.
- `src/utils/jsonArrayUtils.ts` — shared helpers for finding and reading object arrays in parsed JSON.
- `src/utils/jsonToCsv.ts` — CSV conversion logic.
- `src/utils/jsonToExcel.ts` — Excel data conversion and `.xlsx` workbook generation.
- `src/utils/*.test.ts` — unit tests for converters and shared JSON-array helpers.
- `src/style.css` — shared visual styles.
- `vite.config.ts` — configures the two HTML entry pages for production builds.

The two tools intentionally have separate HTML entry pages so each can maintain its own title, description, canonical URL, and social metadata. Shared JSON-array discovery helpers live in `jsonArrayUtils.ts`, rather than in the CSV-specific converter module.
