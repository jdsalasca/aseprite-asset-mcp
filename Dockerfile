FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production
ENV ASEPRITE_PATH=/usr/local/bin/aseprite

CMD ["npm", "run", "mcp", "--silent"]
