# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2.23 AS base
WORKDIR /app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock init-dotenv.ts .env.example /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile && rm .env
# remove devtool dependencies
RUN cd /temp/dev && bun remove oxlint prettier knip prettier-plugin-sh prettier-plugin-toml

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY src src
COPY drizzle drizzle
COPY migrate.ts .
COPY package.json .

# set labels
ARG description
ARG created_at
ARG revision
ARG repository
ARG version

LABEL org.opencontainers.image.description=$description
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.created=$created_at
LABEL org.opencontainers.image.revision=$revision
LABEL org.opencontainers.image.source=$repository
LABEL org.opencontainers.image.version=$version
LABEL org.opencontainers.image.title="BeamUp Server"
LABEL org.opencontainers.image.url=$repository

# run the app
USER bun
EXPOSE 3000/tcp
ENV DB_FILE_NAME=/app/db/db.sqlite3
ENV ALLOWED_ORIGINS=*
ENTRYPOINT [ "sh", "-c", "bun run migrate.ts && bun run src/index.ts" ]
