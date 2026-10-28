#!/usr/bin/env bash
# The real run the demo shows, against the meridian monolith on :5090.
# Saves each command's output in $DEMO_DIR/runs for record.js to replay.
#
#   DEMO_DIR=/abs/demo ./run.sh before   # flow:status, capture, analyze, propose, present
#   DEMO_DIR=/abs/demo ./run.sh after    # after the workspace scene: flow:status, present, flow:status
set -euo pipefail
: "${DEMO_DIR:?set DEMO_DIR to an empty directory for the run}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
CLI=(node "$REPO/bin/run.js")
mkdir -p "$DEMO_DIR/runs"
cd "$DEMO_DIR"
run() { local name=$1; shift; NO_COLOR=1 FORCE_COLOR=0 "${CLI[@]}" "$@" > "runs/$name.out" 2> "runs/$name.err"; echo "  $name ok"; }

case "${1:-}" in
  before)
    run 01-status-empty flow:status ./evidence
    run 02-capture decompose:capture http://localhost:5090 --out ./evidence --explore 20
    run 04-analyze decompose:analyze "$REPO/examples/meridian-monolith" --evidence ./evidence
    run 05-propose decompose:propose ./evidence
    run 07-present decompose:present ./evidence/proposal
    ;;
  after)
    run 08-status-after-ui flow:status ./evidence
    run 09-present-again decompose:present ./evidence/proposal
    run 10-status-final flow:status ./evidence
    ;;
  *) echo "usage: run.sh before|after" >&2; exit 64 ;;
esac
