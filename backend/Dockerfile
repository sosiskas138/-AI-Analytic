FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with timeout and retry
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 10 && \
    npm install --no-audit --no-fund --prefer-offline

# Copy source code
COPY src ./src
COPY database ./database

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server (use dev mode in docker for hot reload)
CMD ["npm", "run", "dev"]
