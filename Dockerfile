FROM node:20-alpine
# ffmpeg + build tools pour @dank074/discord-video-stream (Go Live vrai)
RUN apk add --no-cache ffmpeg python3 make g++ cmake git pkgconfig zeromq-dev
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
