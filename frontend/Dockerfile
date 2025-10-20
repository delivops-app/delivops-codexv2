FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl dos2unix

COPY package.json package-lock.json* ./
RUN npm install
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh
COPY . .

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
