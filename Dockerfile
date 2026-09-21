FROM node:20-slim
# ffmpeg + build tools pour Go Live vrai (Debian)
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ cmake git pkg-config libzmq3-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
