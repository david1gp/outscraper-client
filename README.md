# @adaptive-ds/outscraper-client

Modern, type-safe, Result-based TypeScript client for [Outscraper API](https://outscraper.com) services (Google Maps, Reviews, Leads, Emails & Contacts, and Business Search).

Built with [Valibot](https://valibot.dev) and [@adaptive-ds/result](https://github.com/david1gp/result) — no thrown exceptions, predictable control flow, and full type inference.

## Features

- 🛡️ **Result Pattern**: Never throws unexpected runtime errors; returns `{ success: true, data }` or `{ success: false, op, errorMessage }`.
- ⚡ **Bun First & Modern TS**: Native ESM, modern TypeScript with strict checks.
- 🔍 **Valibot Powered**: Full schema validation on input parameters and runtime responses.
- 🗺️ **Full Outscraper Support**: Google Maps scraper, Google Reviews, Emails & Contacts, Business Database Search, Request Archive polling.

## Installation

```bash
bun add @adaptive-ds/outscraper-client @adaptive-ds/result valibot
```

## Quick Start

### 1. Initialize the Client

```typescript
import { outscraperClientCreate } from "@adaptive-ds/outscraper-client"

const client = outscraperClientCreate({
  apiKey: process.env.OUTSCRAPER_API_KEY!,
})
```

### 2. Search Google Maps Places

```typescript
import { googleMapsSearch } from "@adaptive-ds/outscraper-client"

const result = await googleMapsSearch(client, {
  query: "specialty coffee brooklyn usa",
  limit: 20,
  language: "en",
  region: "us",
})

if (!result.success) {
  console.error(`Operation ${result.op} failed:`, result.errorMessage)
  return
}

console.log("Found places:", result.data)
```

### 3. Extract Emails and Contacts from Domains

```typescript
import { emailsAndContacts } from "@adaptive-ds/outscraper-client"

const result = await emailsAndContacts(client, {
  query: ["stripe.com", "outscraper.com"],
})

if (result.success) {
  console.log("Contacts:", result.data)
}
```

### 4. Fetch Google Maps Reviews

```typescript
import { googleMapsReviews } from "@adaptive-ds/outscraper-client"

const result = await googleMapsReviews(client, {
  query: "ChIJrc9T9fpYwokRdvjYRHT8nI4",
  reviewsLimit: 50,
  sort: "newest",
})

if (result.success) {
  console.log("Reviews:", result.data)
}
```

### 5. Search Outscraper Businesses Database

```typescript
import { businessesSearch } from "@adaptive-ds/outscraper-client"

const result = await businessesSearch(client, {
  query: "software companies",
  limit: 25,
})

if (result.success) {
  console.log("Businesses:", result.data)
}
```

### 6. Asynchronous Requests & Status Polling

```typescript
import { googleMapsSearch, requestArchiveGet } from "@adaptive-ds/outscraper-client"

// Start an async extraction job
const jobResult = await googleMapsSearch(client, {
  query: "dentists miami",
  limit: 100,
  async: true,
})

if (!jobResult.success) {
  console.error(jobResult.errorMessage)
  return
}

if ("id" in jobResult.data) {
  const requestId = jobResult.data.id
  console.log("Async Request ID:", requestId)

  // Later: poll or retrieve results
  const archiveResult = await requestArchiveGet(client, requestId)
  if (archiveResult.success) {
    console.log("Status:", archiveResult.data.status)
    console.log("Data:", archiveResult.data.data)
  }
}
```

## Available Scripts

- `bun run dev` - Run tests in watch mode
- `bun run test` - Run tests with Bun test runner
- `bun run build` - Compile TypeScript to `dist`
- `bun run check` - Typecheck with TypeScript
- `bun run format` - Format code with Biome
- `bun run release` - Automated versioning and GitHub release

## License

[MIT](./LICENSE)
