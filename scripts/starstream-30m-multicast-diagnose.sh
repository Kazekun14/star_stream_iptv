#!/usr/bin/env bash
set -Eeuo pipefail

# StarStream 30-minute multicast / HLS diagnostic
# Read-only: this script does NOT restart FFmpeg, watchdog, nginx, or networking.
#
# Run:
#   sudo bash starstream-30m-multicast-diagnose.sh
#
# Optional:
#   sudo DURATION_MIN=30 INTERVAL_SEC=30 bash starstream-30m-multicast-diagnose.sh

DURATION_MIN="${DURATION_MIN:-30}"
INTERVAL_SEC="${INTERVAL_SEC:-30}"

HLS_ROOT="${HLS_ROOT:-/opt/starstream/api-client/hls/live}"
DB_NAME="${DB_NAME:-starstream}"
IPTV_IF="${IPTV_IF:-enp2s0}"
MCAST_NET="${MCAST_NET:-232.100.0.0/16}"
WATCHDOG_UNIT="${WATCHDOG_UNIT:-starstream-hls-watchdog.service}"
WATCHDOG_TIMER="${WATCHDOG_TIMER:-starstream-hls-watchdog.timer}"
FFMPEG_UNIT="${FFMPEG_UNIT:-starstream-ffmpeg.service}"

if (( EUID != 0 )); then
    echo "ERROR: run with sudo/root:"
    echo "  sudo bash $0"
    exit 1
fi

command -v mariadb >/dev/null || { echo "ERROR: mariadb not found"; exit 1; }
command -v tcpdump >/dev/null || { echo "ERROR: tcpdump not found"; exit 1; }
command -v journalctl >/dev/null || { echo "ERROR: journalctl not found"; exit 1; }

REAL_USER="${SUDO_USER:-root}"
HOME_DIR="$(getent passwd "$REAL_USER" | cut -d: -f6)"
[[ -n "$HOME_DIR" ]] || HOME_DIR="/tmp"

START_TAG="$(date '+%Y%m%d_%H%M%S')"
START_HUMAN="$(date '+%Y-%m-%d %H:%M:%S %Z')"
START_EPOCH="$(date +%s)"
END_EPOCH=$(( START_EPOCH + DURATION_MIN * 60 ))

OUT_DIR="$HOME_DIR/starstream-multicast-diag-$START_TAG"
mkdir -p "$OUT_DIR"

SUMMARY="$OUT_DIR/summary.txt"
SAMPLES="$OUT_DIR/samples.tsv"
CHANNELS_FILE="$OUT_DIR/enabled_channels.tsv"
EVENTS="$OUT_DIR/channel_events.tsv"
IGMP_LOG="$OUT_DIR/igmp.log"
WATCHDOG_LOG="$OUT_DIR/watchdog.log"
FFMPEG_LOG="$OUT_DIR/ffmpeg-service.log"
KERNEL_LOG="$OUT_DIR/kernel.log"
FINAL_PROBES="$OUT_DIR/final_stale_udp_probes.txt"
BASELINE="$OUT_DIR/baseline.txt"

cleanup() {
    if [[ -n "${IGMP_PID:-}" ]] && kill -0 "$IGMP_PID" 2>/dev/null; then
        kill "$IGMP_PID" 2>/dev/null || true
        wait "$IGMP_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$SUMMARY"
}

db() {
    mariadb -N -B -D "$DB_NAME" -e "$1"
}

safe_sysctl() {
    sysctl -n "$1" 2>/dev/null || echo "N/A"
}

nic_counter() {
    local name="$1"
    local f="/sys/class/net/$IPTV_IF/statistics/$name"
    [[ -r "$f" ]] && cat "$f" || echo 0
}

get_mcast_membership_count() {
    ip maddr show dev "$IPTV_IF" 2>/dev/null |
        grep -E 'inet +232\.' |
        wc -l
}

get_udp_socket_count() {
    ss -uanp 2>/dev/null |
        grep -c '232\.100\.' || true
}

get_global_udp_seen() {
    # Very small packet sample: returns quickly when multicast is flowing,
    # otherwise waits at most 2 seconds. It does not dump full IPTV traffic.
    local n
    n="$(
        timeout 2 tcpdump -ni "$IPTV_IF" -nn -q -c 5 \
            "udp and dst net $MCAST_NET" 2>/dev/null |
        wc -l
    )"
    echo "$n"
}

get_ffmpeg_pid_map() {
    # Output: CHANNEL<TAB>PID
    local pid cmd ch
    while read -r pid; do
        [[ -n "$pid" ]] || continue
        [[ -r "/proc/$pid/cmdline" ]] || continue
        cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
        if [[ "$cmd" =~ ${HLS_ROOT}/(CH[0-9]{6})/ ]]; then
            ch="${BASH_REMATCH[1]}"
            printf '%s\t%s\n' "$ch" "$pid"
        fi
    done < <(pgrep -x ffmpeg || true)
}

newest_segment_epoch() {
    local ch="$1"
    local newest
    newest="$(
        find "$HLS_ROOT/$ch" \
            -type f \
            -name 'seg_*.ts' \
            -printf '%T@\n' 2>/dev/null |
        sort -nr |
        head -1
    )"
    if [[ -n "$newest" ]]; then
        printf '%s\n' "${newest%.*}"
    else
        printf '0\n'
    fi
}

parse_source() {
    local uri="$1"
    # Supports udp://@232.x.x.x:port and udp://232.x.x.x:port
    uri="${uri#udp://@}"
    uri="${uri#udp://}"
    uri="${uri%%\?*}"
    printf '%s\t%s\n' "${uri%:*}" "${uri##*:}"
}

# ---------------------------------------------------------------------
# Baseline / enabled channel inventory
# ---------------------------------------------------------------------

db "
SELECT
    channel_key,
    COALESCE(number,''),
    REPLACE(REPLACE(COALESCE(name,''), CHAR(9), ' '), CHAR(10), ' '),
    COALESCE(source_uri,'')
FROM live_channels
WHERE enabled=1
ORDER BY number, channel_key;
" > "$CHANNELS_FILE"

ENABLED_COUNT="$(wc -l < "$CHANNELS_FILE")"

{
    echo "StarStream multicast diagnostic baseline"
    echo "Started: $START_HUMAN"
    echo "Duration: ${DURATION_MIN} minutes"
    echo "Sample interval: ${INTERVAL_SEC} seconds"
    echo "Enabled channels: $ENABLED_COUNT"
    echo
    echo "===== SERVICES ====="
    systemctl is-enabled "$FFMPEG_UNIT" 2>/dev/null || true
    systemctl is-active "$FFMPEG_UNIT" 2>/dev/null || true
    systemctl is-enabled "$WATCHDOG_TIMER" 2>/dev/null || true
    systemctl is-active "$WATCHDOG_TIMER" 2>/dev/null || true
    echo
    echo "===== ROUTES ====="
    ip route
    echo
    echo "===== IPTV ROUTE TEST ====="
    ip route get 232.100.0.1 2>/dev/null || true
    echo
    echo "===== IPTV INTERFACE ====="
    ip -details addr show dev "$IPTV_IF" 2>/dev/null || true
    ip -s link show dev "$IPTV_IF" 2>/dev/null || true
    echo
    echo "===== RP FILTER ====="
    echo "all=$(safe_sysctl net.ipv4.conf.all.rp_filter)"
    echo "default=$(safe_sysctl net.ipv4.conf.default.rp_filter)"
    echo "$IPTV_IF=$(safe_sysctl net.ipv4.conf.${IPTV_IF}.rp_filter)"
    echo
    echo "===== IGMP SETTINGS ====="
    sysctl -a 2>/dev/null | grep -E "^net\.ipv4\.conf\.${IPTV_IF}\.(force_igmp_version|mc_forwarding|rp_filter)" || true
    echo
    echo "===== MULTICAST MEMBERSHIPS ====="
    ip maddr show dev "$IPTV_IF" 2>/dev/null || true
    echo
    echo "===== UDP STATS ====="
    nstat -az 2>/dev/null | grep -E 'Udp(InDatagrams|InErrors|RcvbufErrors|SndbufErrors|NoPorts)' || true
    echo
    echo "===== NIC DRIVER ====="
    ethtool -i "$IPTV_IF" 2>/dev/null || true
} > "$BASELINE"

# Low-volume continuous IGMP capture. This helps determine whether the
# upstream querier is still sending queries and whether the host sends reports.
timeout $((DURATION_MIN * 60 + 15)) \
    tcpdump -tttt -eni "$IPTV_IF" -nn -vvv -s 160 igmp \
    > "$IGMP_LOG" 2>&1 &
IGMP_PID=$!

printf 'timestamp\tepoch\tworkers\tmemberships\tudp_socket_count\tglobal_udp_sample_packets\trx_packets\trx_bytes\trx_multicast\trx_dropped\trx_errors\tudp_in_errors\tudp_rcvbuf_errors\tadvancing\tstale\tno_ts\twatchdog_timer\n' > "$SAMPLES"
printf 'timestamp\tchannel\tnumber\tname\tgroup\tport\tpid\tsegment_epoch\tage_sec\tstate\tpid_changed\n' > "$EVENTS"

declare -A LAST_SEG
declare -A LAST_PID
declare -A CH_NUM
declare -A CH_NAME
declare -A CH_URI
declare -A CH_GROUP
declare -A CH_PORT

while IFS=$'\t' read -r ch num name uri; do
    CH_NUM["$ch"]="$num"
    CH_NAME["$ch"]="$name"
    CH_URI["$ch"]="$uri"
    IFS=$'\t' read -r group port < <(parse_source "$uri")
    CH_GROUP["$ch"]="$group"
    CH_PORT["$ch"]="$port"
    LAST_SEG["$ch"]="0"
    LAST_PID["$ch"]=""
done < "$CHANNELS_FILE"

log "Starting ${DURATION_MIN}-minute diagnostic."
log "Output directory: $OUT_DIR"
log "This is read-only; watchdog and FFmpeg remain under normal production control."

SAMPLE_INDEX=0

while (( $(date +%s) < END_EPOCH )); do
    SAMPLE_INDEX=$((SAMPLE_INDEX + 1))
    TS="$(date '+%Y-%m-%d %H:%M:%S')"
    NOW="$(date +%s)"

    WORKERS="$(pgrep -x ffmpeg 2>/dev/null | wc -l)"
    MEMBERSHIPS="$(get_mcast_membership_count)"
    UDP_SOCKETS="$(get_udp_socket_count)"

    RX_PACKETS="$(nic_counter rx_packets)"
    RX_BYTES="$(nic_counter rx_bytes)"
    RX_MCAST="$(nic_counter multicast)"
    RX_DROPPED="$(nic_counter rx_dropped)"
    RX_ERRORS="$(nic_counter rx_errors)"

    UDP_IN_ERRORS="$(
        nstat -az 2>/dev/null |
        awk '$1=="UdpInErrors"{print $2; found=1} END{if(!found)print 0}'
    )"
    UDP_RCVBUF_ERRORS="$(
        nstat -az 2>/dev/null |
        awk '$1=="UdpRcvbufErrors"{print $2; found=1} END{if(!found)print 0}'
    )"

    GLOBAL_UDP="$(get_global_udp_seen)"
    TIMER_STATE="$(systemctl is-active "$WATCHDOG_TIMER" 2>/dev/null || true)"

    declare -A PID_MAP=()
    while IFS=$'\t' read -r ch pid; do
        [[ -n "$ch" ]] && PID_MAP["$ch"]="$pid"
    done < <(get_ffmpeg_pid_map)

    ADVANCING=0
    STALE=0
    NO_TS=0
    STALE_LIST=()

    for ch in "${!CH_NUM[@]}"; do
        seg="$(newest_segment_epoch "$ch")"
        pid="${PID_MAP[$ch]:-}"
        old_seg="${LAST_SEG[$ch]:-0}"
        old_pid="${LAST_PID[$ch]:-}"
        age=0
        state="ADVANCING"
        pid_changed="0"

        if [[ -n "$old_pid" && -n "$pid" && "$old_pid" != "$pid" ]]; then
            pid_changed="1"
        fi

        if (( seg == 0 )); then
            state="NO_TS"
            age=-1
            NO_TS=$((NO_TS + 1))
            STALE=$((STALE + 1))
            STALE_LIST+=("$ch")
        elif (( old_seg > 0 && seg <= old_seg )); then
            state="STALE"
            age=$(( NOW - seg ))
            STALE=$((STALE + 1))
            STALE_LIST+=("$ch")
        else
            state="ADVANCING"
            age=$(( NOW - seg ))
            ADVANCING=$((ADVANCING + 1))
        fi

        # Log only non-healthy states or PID changes to keep the event file compact.
        if [[ "$state" != "ADVANCING" || "$pid_changed" == "1" ]]; then
            printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
                "$TS" \
                "$ch" \
                "${CH_NUM[$ch]}" \
                "${CH_NAME[$ch]}" \
                "${CH_GROUP[$ch]}" \
                "${CH_PORT[$ch]}" \
                "${pid:-NONE}" \
                "$seg" \
                "$age" \
                "$state" \
                "$pid_changed" \
                >> "$EVENTS"
        fi

        LAST_SEG["$ch"]="$seg"
        LAST_PID["$ch"]="$pid"
    done

    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$TS" "$NOW" "$WORKERS" "$MEMBERSHIPS" "$UDP_SOCKETS" "$GLOBAL_UDP" \
        "$RX_PACKETS" "$RX_BYTES" "$RX_MCAST" "$RX_DROPPED" "$RX_ERRORS" \
        "$UDP_IN_ERRORS" "$UDP_RCVBUF_ERRORS" "$ADVANCING" "$STALE" "$NO_TS" \
        "$TIMER_STATE" >> "$SAMPLES"

    log "sample=$SAMPLE_INDEX workers=$WORKERS memberships=$MEMBERSHIPS udp_sample=$GLOBAL_UDP advancing=$ADVANCING stale=$STALE no_ts=$NO_TS watchdog=$TIMER_STATE"

    if (( STALE > 0 )); then
        log "stale_channels=${STALE_LIST[*]}"
    fi

    # Sleep until next interval, but do not overshoot the requested end time.
    NOW2="$(date +%s)"
    REMAIN=$(( END_EPOCH - NOW2 ))
    (( REMAIN <= 0 )) && break
    SLEEP_FOR="$INTERVAL_SEC"
    (( SLEEP_FOR > REMAIN )) && SLEEP_FOR="$REMAIN"
    sleep "$SLEEP_FOR"
done

# Stop continuous IGMP capture before final analysis.
cleanup
IGMP_PID=""

# ---------------------------------------------------------------------
# Correlated logs from the same observation window
# ---------------------------------------------------------------------

journalctl -u "$WATCHDOG_UNIT" \
    --since "@$START_EPOCH" \
    --no-pager -o short-iso \
    > "$WATCHDOG_LOG" 2>&1 || true

journalctl -u "$FFMPEG_UNIT" \
    --since "@$START_EPOCH" \
    --no-pager -o short-iso \
    > "$FFMPEG_LOG" 2>&1 || true

journalctl -k \
    --since "@$START_EPOCH" \
    --no-pager -o short-iso |
    grep -Ei "$IPTV_IF|igmp|multicast|netdev|link.*(down|up)|watchdog|hang|reset|drop|error|pcie|aer" \
    > "$KERNEL_LOG" 2>/dev/null || true

# ---------------------------------------------------------------------
# Final stale channels: targeted multicast probe
# ---------------------------------------------------------------------

FINAL_NOW="$(date +%s)"
: > "$FINAL_PROBES"

for ch in "${!CH_NUM[@]}"; do
    seg="$(newest_segment_epoch "$ch")"
    if (( seg == 0 || FINAL_NOW - seg > 20 )); then
        group="${CH_GROUP[$ch]}"
        port="${CH_PORT[$ch]}"

        {
            echo "===== $ch num=${CH_NUM[$ch]} name=${CH_NAME[$ch]} source=${CH_URI[$ch]} ====="
            echo "Newest segment epoch=$seg age=$(( seg > 0 ? FINAL_NOW - seg : -1 ))"
            echo "Route:"
            ip route get "$group" 2>/dev/null || true
            echo "Membership:"
            ip maddr show dev "$IPTV_IF" 2>/dev/null | grep -F "$group" || true
            echo "UDP probe (max 5 packets / 2 sec):"
            timeout 2 tcpdump -ni "$IPTV_IF" -nn -q -c 5 \
                "udp and dst host $group and dst port $port" 2>&1 || true
            echo
        } >> "$FINAL_PROBES"
    fi
done

# ---------------------------------------------------------------------
# Heuristic analysis
# ---------------------------------------------------------------------

TOTAL_SAMPLES=$(( $(wc -l < "$SAMPLES") - 1 ))
ZERO_UDP_SAMPLES="$(
    awk -F '\t' 'NR>1 && $6==0{n++} END{print n+0}' "$SAMPLES"
)"
MASS_STALE_SAMPLES="$(
    awk -F '\t' 'NR>1 && $15>=12{n++} END{print n+0}' "$SAMPLES"
)"
FULL_STALE_SAMPLES="$(
    awk -F '\t' -v e="$ENABLED_COUNT" 'NR>1 && $15>=e-3{n++} END{print n+0}' "$SAMPLES"
)"
MEMBERSHIP_OK_DURING_ZERO_UDP="$(
    awk -F '\t' -v e="$ENABLED_COUNT" 'NR>1 && $6==0 && $4>=e-2{n++} END{print n+0}' "$SAMPLES"
)"
WATCHDOG_GLOBAL="$(
    grep -c 'GLOBAL_RESTART' "$WATCHDOG_LOG" 2>/dev/null || true
)"
WATCHDOG_INDIV="$(
    grep -c 'RESTART channel=' "$WATCHDOG_LOG" 2>/dev/null || true
)"
IGMP_QUERIES="$(
    grep -Eic 'query' "$IGMP_LOG" 2>/dev/null || true
)"
IGMP_REPORTS="$(
    grep -Eic 'report|membership' "$IGMP_LOG" 2>/dev/null || true
)"

FIRST_RX_DROP="$(
    awk -F '\t' 'NR==2{print $10}' "$SAMPLES"
)"
LAST_RX_DROP="$(
    tail -1 "$SAMPLES" | awk -F '\t' '{print $10}'
)"
FIRST_RX_ERR="$(
    awk -F '\t' 'NR==2{print $11}' "$SAMPLES"
)"
LAST_RX_ERR="$(
    tail -1 "$SAMPLES" | awk -F '\t' '{print $11}'
)"
DROP_DELTA=$(( LAST_RX_DROP - FIRST_RX_DROP ))
ERR_DELTA=$(( LAST_RX_ERR - FIRST_RX_ERR ))

{
    echo
    echo "======================================================"
    echo " FINAL DIAGNOSTIC SUMMARY"
    echo "======================================================"
    echo "Observation start        : $START_HUMAN"
    echo "Observation end          : $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Enabled channels         : $ENABLED_COUNT"
    echo "Samples                  : $TOTAL_SAMPLES"
    echo "Zero IPTV UDP samples    : $ZERO_UDP_SAMPLES"
    echo "Mass-stale samples >=12  : $MASS_STALE_SAMPLES"
    echo "Near-total stale samples : $FULL_STALE_SAMPLES"
    echo "Zero UDP + memberships OK: $MEMBERSHIP_OK_DURING_ZERO_UDP"
    echo "Watchdog global restarts : $WATCHDOG_GLOBAL"
    echo "Watchdog indiv restarts  : $WATCHDOG_INDIV"
    echo "IGMP query lines seen    : $IGMP_QUERIES"
    echo "IGMP report lines seen   : $IGMP_REPORTS"
    echo "NIC RX drop delta        : $DROP_DELTA"
    echo "NIC RX error delta       : $ERR_DELTA"
    echo
    echo "===== INTERPRETATION ====="

    if (( ZERO_UDP_SAMPLES > 0 &&
          MEMBERSHIP_OK_DURING_ZERO_UDP > 0 &&
          MASS_STALE_SAMPLES > 0 )); then
        echo "STRONG SIGNAL: upstream multicast forwarding / IGMP state problem."
        echo "Reason: IPTV UDP disappeared while Linux multicast memberships remained,"
        echo "and many HLS channels stalled together. This points away from FFmpeg/HLS"
        echo "as the primary cause and toward upstream IGMP snooping/querier/forwarding"
        echo "state, receiver-port group state, multicast admission/group limits, or"
        echo "multicast forwarding-table aging."
    elif (( ZERO_UDP_SAMPLES == 0 && MASS_STALE_SAMPLES > 0 )); then
        echo "SIGNAL: multicast packets continued arriving while many HLS outputs stalled."
        echo "Investigate FFmpeg input/decode/muxing, UDP receive-buffer errors, CPU/memory,"
        echo "and per-channel logs rather than upstream forwarding first."
    elif (( DROP_DELTA > 0 || ERR_DELTA > 0 )); then
        echo "SIGNAL: NIC receive drops/errors increased during the observation."
        echo "Investigate interface/driver/link health, receive queues, kernel buffers,"
        echo "and host load in addition to multicast control-plane behavior."
    else
        echo "No single root cause was proven during this 30-minute window."
        echo "Use samples.tsv + watchdog.log + igmp.log + channel_events.tsv to correlate"
        echo "the exact time of the next freeze."
    fi

    echo
    echo "Files:"
    echo "  $SAMPLES"
    echo "  $EVENTS"
    echo "  $IGMP_LOG"
    echo "  $WATCHDOG_LOG"
    echo "  $FFMPEG_LOG"
    echo "  $KERNEL_LOG"
    echo "  $FINAL_PROBES"
    echo "  $BASELINE"
} | tee -a "$SUMMARY"

if [[ "$REAL_USER" != "root" ]]; then
    chown -R "$REAL_USER":"$(id -gn "$REAL_USER")" "$OUT_DIR" 2>/dev/null || true
fi

echo
echo "Diagnostic complete."
echo "Report directory: $OUT_DIR"
echo "Main summary:     $SUMMARY"
