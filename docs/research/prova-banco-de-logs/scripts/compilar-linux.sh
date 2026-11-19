#!/bin/sh
# Compila a bancada para Ubuntu 24.04. Uso: sh scripts/compilar-linux.sh arm64|amd64
set -eu
arquitetura="$1"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
docker run --rm --platform "linux/$arquitetura" \
  -v "$pasta_prova/bancada:/bancada" \
  -v "prova-banco-cargo-$arquitetura:/root/.cargo" \
  -v "prova-banco-rustup-$arquitetura:/root/.rustup" \
  -e "CARGO_TARGET_DIR=/bancada/target-linux-$arquitetura" -w /bancada ubuntu:24.04 sh -eu -c '
    apt-get update -qq >/dev/null
    apt-get install -y -qq curl build-essential ca-certificates >/dev/null
    [ -x /root/.cargo/bin/cargo ] || curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.99.1 >/dev/null 2>&1
    /root/.cargo/bin/cargo build --release --locked 2>&1 | tail -1'
