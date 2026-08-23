FROM docker.io/library/node:26 AS build

WORKDIR /workspace

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build


FROM docker.io/library/nginx:1.31.3

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
