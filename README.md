# @adaptive-ds/outscraper-client

Type-safe TypeScript library and CLI for the [Outscraper API](https://outscraper.com). Inputs and responses are validated with [Valibot](https://valibot.dev), and endpoint operations return [@adaptive-ds/result](https://github.com/david1gp/result) values.

## Installation and authentication

```bash
bun add @adaptive-ds/outscraper-client @adaptive-ds/result valibot
export OUTSCRAPER_API_KEY="your-api-key"
```

For a global CLI installation, use `bun add --global @adaptive-ds/outscraper-client @adaptive-ds/result valibot`.

Keep the key in the environment (or pass `--api-key` to the CLI); it is not printed in results or errors. `OUTSCRAPER_BASE_URL` may also override the API URL.

## Library

Create a validated client, then call a generated operation. Generated inputs are grouped by HTTP location (`path`, `query`, `headers`, and, for body operations, `body`):

```typescript
import {
  googleMapsSearchGet,
  outscraperClientCreateResult,
} from "@adaptive-ds/outscraper-client"

const clientResult = outscraperClientCreateResult({
  apiKey: process.env.OUTSCRAPER_API_KEY,
})
if (!clientResult.success) {
  console.error(clientResult.errorMessage)
} else {
  const result = await googleMapsSearchGet(clientResult.data, {
    query: {
      async: false,
      limit: 3,
      query: "coffee shops, Brooklyn, NY, USA",
    },
  })

  if (result.success) console.log(result.data)
  else console.error(`${result.op}: ${result.errorMessage}`)
}
```

POST operations use the same convention. For example:

```typescript
import { googleMapsSearchPost } from "@adaptive-ds/outscraper-client"

if (clientResult.success) {
  const result = await googleMapsSearchPost(clientResult.data, {
    query: {
      async: true,
      limit: 3,
      query: "coffee shops, Brooklyn, NY, USA",
    },
  })
  if (result.success) console.log(result.data)
}
```

Every generated operation is exported from the package root. It is also importable by its generated endpoint path, for example:

```typescript
import { googleMapsSearchGet } from "@adaptive-ds/outscraper-client/get-google-maps-search/googleMapsSearchGet"
```

The source layout is `src/<method>-<path-slug>/`: each operation has an operation function, input schema, response schema, and definition. The checked-in normalized catalog at `openapi/outscraper-api.normalized.json` is the discovery source. The older convenience exports such as `googleMapsSearch` remain available for compatibility.

## Results and asynchronous requests

Endpoint calls return `Result<T>`:

- success: `{ success: true, data }`
- failure: `{ success: false, op, errorMessage }`

Input, transport, HTTP, and response-validation failures are returned as errors rather than thrown by endpoint calls. Use `outscraperClientCreateResult` when client configuration should also follow this pattern. For an asynchronous operation, submit with `async: true`, read the returned request ID, and poll the generated `requestsRequestIdGet` operation:

```typescript
import { googleMapsSearchGet, requestsRequestIdGet } from "@adaptive-ds/outscraper-client"

if (clientResult.success) {
  const started = await googleMapsSearchGet(clientResult.data, {
    query: { async: true, limit: 3, query: "dentists, Miami, FL, USA" },
  })
  if (started.success && started.data && "id" in started.data && started.data.id) {
    const status = await requestsRequestIdGet(clientResult.data, {
      path: { requestId: started.data.id },
    })
    if (status.success) console.log(status.data)
  }
}
```

## CLI

The package installs the `outscraper-client` executable. See all generated routes and flags without making an API call:

```bash
outscraper-client --help
outscraper-client get --help
outscraper-client get google-maps-search --help
outscraper-client post --help
outscraper-client --version
```

Routes are grouped by HTTP method and then use the endpoint path slug. Representative requests:

```bash
outscraper-client get google-maps-search \
  --query-query "coffee shops, Brooklyn, NY, USA" \
  --query-limit 3 \
  --query-async false

outscraper-client post tasks \
  --body '{"service_name":"google_maps_search","queries":["coffee shops, Brooklyn, NY, USA"]}'
```

The CLI writes successful data as JSON to stdout. Result errors are JSON on stderr with exit code `1`; API keys are redacted. During development, use `bun run cli -- --help` or `bun run cli -- get google-maps-search --help`.

## Development and testing

```bash
bun install
bun run openapi:snapshot       # fetch the official OpenAPI document
bun run openapi:normalize      # normalize the checked-in snapshot
bun run generate               # regenerate src endpoint files and exports
bun run cli -- --help          # run the CLI from source
bun run check                  # TypeScript check
bun run test                   # Bun unit/integration tests
bun run build                  # emit dist and the executable CLI
bun run dev                    # test watch mode
bun run format                # format source, scripts, tests, and config
```

`openapi:snapshot` uses the documented Outscraper OpenAPI URL by default; it is not needed for ordinary library or CLI use. `generate` reads `openapi/outscraper-api.normalized.json` by default and keeps generated exports and CLI routes in sync with that catalog.

## License

[MIT](./LICENSE)
