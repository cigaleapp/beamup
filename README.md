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

The server requires a Postgres database. Provide its connection string via the `DATABASE_URL` environment variable.

Use the Docker image:

```sh
docker run -p 8000:3000 -e PROD=true -e DATABASE_URL=postgres://user:pass@host:5432/beamup ghcr.io/cigaleapp/beamup:latest
```

- `-p`: listen on host machine's :8000
- `-e`: set to production mode
- `-e DATABASE_URL`: connection string to your Postgres database

Or use the provided `docker-compose.yaml`, which starts the app alongside a Postgres instance:

```sh
docker compose up
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
