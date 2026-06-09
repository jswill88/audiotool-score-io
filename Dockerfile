FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    musescore \
    xauth \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
COPY packages/midi-to-musicxml/package.json packages/midi-to-musicxml/package.json
COPY packages/audiotool-to-midi/package.json packages/audiotool-to-midi/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace @midi-to-xml/midi-to-musicxml \
  && npm prune --omit=dev

ENV MUSESCORE_USE_XVFB=auto

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@midi-to-xml/api"]
