FROM docker.io/library/rust:1.99.1-bookworm AS build
WORKDIR /workspace
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src ./src
COPY migration ./migration
RUN cargo fmt --all --check && cargo clippy --locked --all-targets -- -D warnings && cargo build --release --locked

FROM docker.io/library/debian:bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/mucsi96/cooking-app"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV LOCO_ENV=production SERVER_PORT=8080 MANAGEMENT_PORT=8081
COPY --from=build /workspace/target/release/cooking-server /app/cooking
COPY config ./config
EXPOSE 8080 8081
ENTRYPOINT ["/app/cooking"]
CMD ["start", "--no-banner"]
