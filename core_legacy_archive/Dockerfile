# Use the official high-performance Bun runtime image
FROM oven/bun:1-alpine

# Set working directory inside container
WORKDIR /app

# Copy package configurations first to leverage layer cache
COPY package.json ./
COPY admin/package.json ./admin/
COPY server/package.json ./server/

# Install workspaces dependencies
RUN npm install

# Copy all source files
COPY . .

# Compile static React Admin assets
RUN npm run build:admin

# Expose server port
EXPOSE 3000

# Set environment defaults
ENV PORT=3000
ENV PIDASH_IPC_DIR=/tmp/widgets

# Run the Bun server process
CMD ["bun", "run", "server/index.ts"]
