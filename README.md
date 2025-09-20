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

Use the Docker image:

```
docker run -p 3000:3000 -v ./db.sqlite3:/app/db.sqlite3:rw ghcr.io/cigaleapp/beamup:latest
```

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
