FROM alpine:3.24.2@sha256:d56c381f961d307a21b3ca004cf1e3910f106644aefb1f43e654c8a56c4fd395

RUN apk add --no-cache wireguard-tools=1.0.20260223-r0 iproute2 iptables

COPY --chmod=0555 entrypoint.sh /usr/local/bin/nexo-wireguard-entrypoint

ENTRYPOINT ["/usr/local/bin/nexo-wireguard-entrypoint"]
