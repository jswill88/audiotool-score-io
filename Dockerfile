FROM node:20-bullseye-slim

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
RUN npm ci --omit=dev
COPY . .

ENV MUSESCORE_USE_XVFB=auto

EXPOSE 3000
CMD ["npm", "start"]
