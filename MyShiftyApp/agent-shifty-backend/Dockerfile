# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json file first.
COPY package*.json ./

# Clean the cache and then install dependencies. This is more robust.
RUN npm cache clean --force && npm install

# Bundle the rest of your app's source code
COPY . .

# Tell Docker about the port your app uses
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "start" ]
