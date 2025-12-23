FROM rust:1.82 AS build
WORKDIR /app
# Copy crate (no dummy layer; simpler and avoids confusion)
COPY component-system/daemon/rust/component-daemon/ ./
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/component-daemon /usr/local/bin/component-daemon
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["component-daemon"]
