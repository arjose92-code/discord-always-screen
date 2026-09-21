FROM node:20-alpine
# ffmpeg nécessaire seulement si MODE=stream (vrai Go Live)
RUN apk add --no-cache ffmpeg python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
