FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg && pip3 install --no-cache-dir yt-dlp

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

CMD ["npm", "start"]
