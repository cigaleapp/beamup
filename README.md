# beamup

Send corrections to a CIGALE BeamUp server.

## Client library

### Usage

```ts
import { sendCorrection } from "@cigale/beamup";

await sendCorrection({
    origin: "https://beamup.example.com",
    ...
})
```

## Server

### Usage

Use the Docker image [coming soon]

### Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

To develop:

```bash
bun run --watch src/index.ts
```

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
