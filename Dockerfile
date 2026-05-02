FROM node:20-alpine AS build
WORKDIR /app
ADD package.json package-lock.json /app/
RUN npm ci
ADD . /app/
RUN npx tsc

FROM node:20-alpine
ENV NODE_ENV production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ADD package.json package-lock.json /app/
RUN npm ci --omit=dev
COPY --from=build /app/dist/ /app/
COPY --from=build /app/UFBA_TEMPLATE.docx /app/
COPY ormconfig.ts /app/
COPY ormconfig.js /app/
EXPOSE 3333
CMD ["node", "-r", "source-map-support/register" , "/app/src/server.js"]
