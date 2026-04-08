FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY commands/ ./commands/
COPY utils/ ./utils/
COPY bot.js database.js deploy-commands.js ./

CMD ["npm", "run", "start"]
