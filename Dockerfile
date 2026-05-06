FROM node:20-bookworm-slim AS build
WORKDIR /app
ADD package.json package-lock.json /app/
RUN npm ci
ADD . /app/
RUN npx tsc

FROM node:20-bookworm-slim
ENV NODE_ENV production
ENV LIBREOFFICE_BIN=/usr/bin/libreoffice
ENV PDF_CONVERSION_TIMEOUT_MS=45000
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	libreoffice \
	libreoffice-writer \
	ca-certificates \
	fonts-dejavu \
	fonts-liberation \
	fonts-noto-core \
	&& rm -rf /var/lib/apt/lists/*

ADD package.json package-lock.json /app/
RUN npm ci --omit=dev
COPY --from=build /app/dist/ /app/
COPY --from=build /app/UFBA_TEMPLATE.docx /app/
COPY ormconfig.ts /app/
COPY ormconfig.js /app/
EXPOSE 3333
CMD ["node", "-r", "source-map-support/register" , "/app/src/server.js"]
