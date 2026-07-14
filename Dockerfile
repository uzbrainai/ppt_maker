# slidewind — editable PPTX/PDF generation (CLI + LLM orchestration).
#
# Multi-stage: build the TypeScript, then ship a slim runtime that includes
# LibreOffice (for --pdf export) and fonts.

# ---------- build stage ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- slim runtime (no LibreOffice) ----------
# Builds in seconds. Generates .pptx only; convert to PDF on the host (or use
# the full `runtime` target below, which bundles LibreOffice).
FROM node:22-bookworm-slim AS runtime-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY SKILL.md ./SKILL.md
COPY examples ./examples
RUN mkdir -p /out
VOLUME ["/out"]
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]

# ---------- front/web build stage ----------
# Builds the Vite + React UI (front/web) into static assets. VITE_SLIDEWIND_BASE
# defaults to /api so the served bundle talks to the slidewind service via the
# nginx reverse proxy on the same origin (no CORS, no hardcoded host).
FROM node:22-bookworm-slim AS web-build
WORKDIR /web
ARG VITE_SLIDEWIND_BASE=/api
ARG VITE_API_BASE=
ARG VITE_BASE=/
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_SLIDEWIND_BASE=${VITE_SLIDEWIND_BASE}
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_BASE=${VITE_BASE}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
COPY front/web/package.json front/web/package-lock.json* ./
RUN npm install
COPY front/web ./
RUN npm run build

# ---------- web runtime (nginx serving the built SPA + proxying /api/) ----------
FROM nginx:1.27-alpine AS web
COPY deploy/nginx/web.docker.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf.dpkg-dist 2>/dev/null || true
COPY --from=web-build /web/dist /usr/share/nginx/html
EXPOSE 80

# ---------- front/admin build stage ----------
# Builds the Vite + React admin SPA (front/admin). Same /api convention as web.
FROM node:22-bookworm-slim AS admin-build
WORKDIR /admin
ARG VITE_API_BASE=/api
ARG VITE_BASE=/
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_BASE=${VITE_BASE}
COPY front/admin/package.json front/admin/package-lock.json* ./
RUN npm install
COPY front/admin ./
RUN npm run build

# ---------- admin runtime (nginx serving the built admin SPA + proxying /api/) ----------
FROM nginx:1.27-alpine AS admin
COPY deploy/nginx/admin.docker.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf.dpkg-dist 2>/dev/null || true
COPY --from=admin-build /admin/dist /usr/share/nginx/html
EXPOSE 80

# ---------- runtime stage (with LibreOffice for in-container --pdf) ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production

# LibreOffice (headless) for PPTX→PDF + fonts for clean rendering.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-impress \
      fonts-dejavu \
      fonts-liberation \
      fontconfig \
 && rm -rf /var/lib/apt/lists/*
ENV SOFFICE_BIN=/usr/bin/soffice

WORKDIR /app
# Production deps only.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# App artifacts.
COPY --from=build /app/dist ./dist
COPY SKILL.md ./SKILL.md
COPY examples ./examples

# Output directory (mount a volume here to retrieve decks).
RUN mkdir -p /out
VOLUME ["/out"]

# OPENAI_API_KEY is provided at runtime (-e OPENAI_API_KEY=... or --env-file).
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
