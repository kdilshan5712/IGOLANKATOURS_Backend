# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code (.env is excluded via .dockerignore)
COPY . .

# Always run as production in the container.
# Actual secrets (DB, PayHere keys, JWT) are injected via
# Azure Container App environment variables / GitHub Secrets — NOT the .env file.
ENV NODE_ENV=production

# Expose backend port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
