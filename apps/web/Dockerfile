FROM node:22-bullseye-slim AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/midi-to-musicxml/package.json packages/midi-to-musicxml/package.json
COPY packages/audiotool-to-midi/package.json packages/audiotool-to-midi/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.base.json tsconfig.base.json
COPY apps/web apps/web

ARG VITE_API_BASE_URL=
ARG VITE_AUDIOTOOL_CLIENT_ID=
ARG VITE_AUDIOTOOL_REDIRECT_URL=
ARG VITE_AUDIOTOOL_SCOPE=project:write
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUDIOTOOL_CLIENT_ID=$VITE_AUDIOTOOL_CLIENT_ID
ENV VITE_AUDIOTOOL_REDIRECT_URL=$VITE_AUDIOTOOL_REDIRECT_URL
ENV VITE_AUDIOTOOL_SCOPE=$VITE_AUDIOTOOL_SCOPE

RUN npm run build --workspace @midi-to-xml/web

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
