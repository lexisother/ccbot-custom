## build runner
FROM node:lts-alpine as build-runner

# Add git and gyp deps
RUN apk add git g++ make py3-pip

# Set temp directory
WORKDIR /tmp/app

# Move package.json
COPY package.json .
COPY dynamic-data ./dynamic-data

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Move source files
COPY src ./src
COPY tsconfig.json   .

# Build project
RUN pnpm run build

## producation runner
FROM node:lts-alpine as prod-runner

# Add git and gyp deps
RUN apk add git g++ make py3-pip

# Set work directory
WORKDIR /app

# Copy package.json from build-runner
COPY --from=build-runner /tmp/app/package.json /app/package.json

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --only=production

# Move build files
COPY --from=build-runner /tmp/app/dist /app/dist
COPY --from=build-runner /tmp/app/dynamic-data /app/dynamic-data-template

# Start bot
CMD [ "cp", "-r", "dynamic-data-template", "dynamic-data", "&&", "node", "dist/main.js" ]
