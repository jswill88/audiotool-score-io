FROM node:22-bullseye-slim AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/midi-to-musicxml/package.json packages/midi-to-musicxml/package.json
COPY packages/audiotool-to-midi/package.json packages/audiotool-to-midi/package.json
COPY packages/score-to-audiotool/package.json packages/score-to-audiotool/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.base.json tsconfig.base.json
COPY packages packages
COPY apps/api apps/api

RUN npm run build --workspace @midi-to-xml/audiotool-to-midi \
  && npm run build --workspace @midi-to-xml/midi-to-musicxml \
  && npm run build --workspace @midi-to-xml/score-to-audiotool \
  && npm run build --workspace @midi-to-xml/api

FROM node:22-bullseye-slim AS runtime

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/midi-to-musicxml/package.json packages/midi-to-musicxml/package.json
COPY packages/audiotool-to-midi/package.json packages/audiotool-to-midi/package.json
COPY packages/score-to-audiotool/package.json packages/score-to-audiotool/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /usr/src/app/packages/midi-to-musicxml/dist packages/midi-to-musicxml/dist
COPY --from=build /usr/src/app/packages/audiotool-to-midi/dist packages/audiotool-to-midi/dist
COPY --from=build /usr/src/app/packages/score-to-audiotool/dist packages/score-to-audiotool/dist
COPY --from=build /usr/src/app/apps/api/dist apps/api/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@midi-to-xml/api"]
