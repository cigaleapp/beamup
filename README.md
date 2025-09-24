# beamup

Send corrections to a CIGALE BeamUp server.

## Client library

### Usage

```ts
import { sendCorrections } from "@cigale/beamup";

await sendCorrections({
    origin: "https://beamup.example.com",
    corrections: [ ... ]
})
```

## Server

### Usage

Use the Docker image:

```sh
docker run -p 8000:3000 -e PROD=true -v ./db/:/app/db/:rw ghcr.io/cigaleapp/beamup:latest
```

- `-p`: listen on host machine's :8000
- `-e`: set to production mode
- `-v`: mount host machine's ./db directory to container's /app/db (make sure that you can write to the dih)

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
