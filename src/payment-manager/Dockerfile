FROM node:8.9.1-alpine

WORKDIR /tmp
ADD package.json /tmp/
RUN npm install --verbose
RUN cp -a /tmp/node_modules /build

WORKDIR /build
RUN cp -a /tmp/node_modules /build

COPY . .

CMD ./bin/www
