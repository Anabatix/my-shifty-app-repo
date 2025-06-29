# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and the lock file
COPY package*.json ./

# Install dependencies using the lock file for consistency
RUN npm ci

# Bundle app source
COPY . .

# Your app binds to port 8080 so you need to tell Docker about it
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "start" ]