FROM node:22-slim
# ffmpeg + build tools pour Go Live (trixie glibc 2.38 pour node-datachannel)
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ cmake git pkg-config libzmq3-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
# installe optionalDependencies nécessaires pour node-datachannel (ne pas omettre)
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
