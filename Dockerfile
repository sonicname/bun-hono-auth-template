# Development Dockerfile for Hono.js with Bun
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose the port (default Bun dev server port)
EXPOSE 3000

# Start the development server with hot reload
CMD ["bun", "run", "dev"]
