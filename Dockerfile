# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2.22 AS base
WORKDIR /app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock init-dotenv.ts .env.example /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile && rm .env
# remove devtool dependencies
RUN cd /temp/dev && bun remove oxlint prettier knip

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY src src
COPY drizzle drizzle
COPY migrate.ts .

# run the app
USER bun
EXPOSE 3000/tcp
ENV DB_FILE_NAME=/app/db.sqlite3
ENTRYPOINT [ "sh", "-c", "bun run migrate.ts && bun run src/index.ts" ]
