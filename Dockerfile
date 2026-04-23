FROM node:20-alpine AS build
WORKDIR /app
ADD package.json package-lock.json /app/
RUN npm ci
ADD . /app/
RUN npx tsc

FROM node:20-alpine
ENV NODE_ENV production
WORKDIR /app

ADD package.json package-lock.json /app/
RUN npm ci --omit=dev
COPY --from=build /app/dist/ /app/
COPY ormconfig.ts /app/
COPY ormconfig.js /app/
EXPOSE 3333
CMD ["node", "-r", "source-map-support/register" , "/app/src/server.js"]
