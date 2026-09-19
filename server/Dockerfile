FROM docker.io/library/golang:1.26.7-alpine AS build
WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /cooking ./cmd/server

FROM docker.io/library/alpine:3.23
RUN apk add --no-cache ca-certificates curl ffmpeg
WORKDIR /app
ENV SERVER_PORT=8080 MANAGEMENT_PORT=8081 GOMEMLIMIT=256MiB
COPY --from=build /cooking /app/cooking
EXPOSE 8080 8081
ENTRYPOINT ["/app/cooking"]
