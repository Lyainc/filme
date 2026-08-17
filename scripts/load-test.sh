#!/usr/bin/env bash
# 부하 하에서 테스트 스위트를 돌려 플레이키를 재현하는 하네스.
# https://github.com/Lyainc/filme/issues/717 코멘트에 적힌 부하 전략 3종(A/B/C)을
# 다음 라운드가 즉석에서 다시 짜지 않도록 재구성 가능하게 남긴 것.
set -uo pipefail

# --- 부하 강도 (조정할 값은 전부 여기) ---------------------------------------
# timeout은 상수로 안 들고 `bun run test`(package.json)를 그대로 부른다 — 따로 들면 CI/로컬과
# 다시 어긋나는 네 번째 사본이 되고, ciLocalTimeoutParity.test.ts(#714)는 그 사본을 못 본다.
A_YES=40                # A: `yes` 프로세스 개수
B_YES=24                # B: `yes` 프로세스 개수
B_MEM_PROCS=6           # B: 메모리 압박 프로세스 개수
B_MEM_MB=1200           # B: 프로세스당 확보 메모리(MB)
B_DD_PROCS=4            # B: 디스크 I/O(dd) 프로세스 개수
B_DD_CHUNK_MB=256       # B: dd 한 벌당 쓰는 크기(MB, 같은 파일을 계속 덮어씀)
B_SUITES=3              # B: 동시에 돌리는 전 스위트 개수
RERUN="${RERUN:-100}"   # C: `--rerun-each` 값

LOAD_PIDS=()
SUITE_PIDS=()
SCRATCH=""

cleanup() {
  local pid
  for pid in "${LOAD_PIDS[@]:-}" "${SUITE_PIDS[@]:-}"; do
    [ -z "$pid" ] && continue
    # dd는 `( while :; do dd ...; done ) &`로 띄워서 손자다 — 부모(서브셸)만 죽이면 실행
    # 중이던 dd 자체는 안 죽는다. 자식부터 정리하고 부모를 죽인다.
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null
  done
  # 이름으로 훑는 `pkill -x yes`를 여기 두면 안 된다 — 남이 띄운 `yes`까지 죽인다. 이 하네스는
  # 여러 벌을 동시에 돌리는 게 정상 사용법이라(전략 B가 스위트 3벌 동시), 한쪽 cleanup이 다른
  # 쪽 부하를 조용히 걷어가면 재현 조건 자체가 달라진다. 위 루프가 LOAD_PIDS를 개별로 들고
  # 있으므로 이름 기반 광역 kill은 애초에 필요가 없다(fresh-context 리뷰 지적).
  if [ -n "$SCRATCH" ] && [ -d "$SCRATCH" ]; then
    # P4(trash-put)의 예외 — mktemp -d로 방금 만든 제 스크래치 안의, 제가 만든 chunk.* 뿐이고
    # 재귀도 없다. dd가 쌓는 수백 MB~GB를 휴지통으로 보내면 디스크 압박을 재현하려고 만든
    # 파일이 그대로 디스크에 남아 목적과 정면으로 어긋난다.
    rm -f "$SCRATCH"/chunk.* 2>/dev/null
    rmdir "$SCRATCH" 2>/dev/null
  fi
  return 0
}
trap cleanup EXIT TERM
# INT(Ctrl-C)는 EXIT 트랩과 분리한다 — 안 그러면 cleanup만 돌고 스크립트가 안 끝나
# 전략 B의 스위트 3벌이 부하 없이도 계속 돈다.
trap 'cleanup; exit 130' INT

spawn_yes() {
  local i
  for ((i = 0; i < $1; i++)); do
    yes > /dev/null &
    LOAD_PIDS+=($!)
  done
}

spawn_mem() {
  # Buffer는 힙 밖이라 --max-old-space-size 조정 없이 그대로 잡힌다.
  local i
  for ((i = 0; i < B_MEM_PROCS; i++)); do
    node -e "const b=Buffer.alloc($B_MEM_MB*1024*1024,1);setInterval(()=>{b[0]^=1},60000)" &
    LOAD_PIDS+=($!)
  done
}

spawn_dd() {
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/filme-loadtest.XXXXXX")"
  # ponytail: bs는 바이트로 준다 — macOS는 `1m`, GNU는 `1M`이라 접미어가 안 겹친다.
  local i
  for ((i = 0; i < B_DD_PROCS; i++)); do
    ( while :; do
        dd if=/dev/zero of="$SCRATCH/chunk.$i" bs=1048576 count=$B_DD_CHUNK_MB 2>/dev/null
      done ) &
    LOAD_PIDS+=($!)
  done
}

usage() {
  cat <<'EOF'
usage: scripts/load-test.sh {A|B|C} [bun test 추가 인자...]

  A  yes 40개를 띄우고 전 스위트 1벌
  B  메모리 6×1.2GB + dd 4개 + yes 24개 아래에서 전 스위트 3벌 동시
  C  같은 테스트를 반복 (bun의 --rerun-each, 기본 100 · RERUN=N 으로 조정)

예: RERUN=20 scripts/load-test.sh C __tests__/landingOverlay.test.tsx
EOF
}

strategy="${1:-}"
[ $# -gt 0 ] && shift

case "$strategy" in
  A)
    echo "[load-test] A: yes ×$A_YES + 전 스위트 1벌"
    spawn_yes "$A_YES"
    bun run test -- "$@"
    exit $?
    ;;

  B)
    echo "[load-test] B: mem ${B_MEM_PROCS}×${B_MEM_MB}MB + dd ×$B_DD_PROCS + yes ×$B_YES + 전 스위트 ${B_SUITES}벌 동시"
    spawn_mem
    spawn_dd
    spawn_yes "$B_YES"

    logs=()
    for ((n = 1; n <= B_SUITES; n++)); do
      log="${TMPDIR:-/tmp}/filme-loadtest-B-$n.log"
      bun run test -- "$@" > "$log" 2>&1 &
      SUITE_PIDS+=($!)
      logs+=("$log")
      echo "[load-test]   suite $n → $log (pid $!)"
    done

    # 부하 프로세스는 영영 안 끝나므로 인자 없는 `wait`를 쓰면 안 된다. 스위트 PID만 기다린다.
    rc=0
    for ((n = 0; n < ${#SUITE_PIDS[@]}; n++)); do
      wait "${SUITE_PIDS[$n]}"
      s=$?
      if [ "$s" -ne 0 ]; then
        rc=$s
        echo "[load-test]   suite $((n + 1)) FAILED (exit $s) → ${logs[$n]}"
      fi
    done
    exit $rc
    ;;

  C)
    echo "[load-test] C: --rerun-each=$RERUN"
    bun run test -- --rerun-each="$RERUN" "$@"
    exit $?
    ;;

  *)
    usage
    exit 1
    ;;
esac
