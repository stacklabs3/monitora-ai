#!/bin/sh
# Compila o servidor estático, para rodar dentro do contêiner de qualquer banco.
set -eu
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
docker run --rm -v "$pasta_prova/bancada:/bancada" -v prova-banco-cargo-musl:/usr/local/cargo/registry \
  -e CARGO_TARGET_DIR=/bancada/target-musl-arm64 -w /bancada rust:1.99-alpine sh -eu -c '
    apk add --quiet musl-dev gcc make perl
    cargo build --release --locked --bin servidor 2>&1 | tail -1'
