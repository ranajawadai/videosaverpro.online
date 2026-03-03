FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir yt-dlp
ENV PATH="/opt/venv/bin:$PATH"

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 8080
CMD ["npm", "start"]
