#!/usr/bin/env python3
"""Atomically sync Grafana and metrics secrets from standard input."""

from __future__ import annotations

import base64
import os
import pathlib
import stat
import sys
import tempfile


SECRET_NAMES = (
    "GRAFANA_ADMIN_PASSWORD",
    "PROMETHEUS_SCRAPE_TOKEN",
    "POSTGRES_EXPORTER_PASSWORD",
)


def read_secrets() -> dict[str, str]:
    try:
        lines = sys.stdin.buffer.read().decode("ascii").splitlines()
    except UnicodeDecodeError as error:
        raise ValueError("Los secretos de monitoreo deben ser Base64 ASCII.") from error

    if len(lines) != len(SECRET_NAMES):
        raise ValueError("Se esperaban exactamente tres secretos de monitoreo.")

    secrets: dict[str, str] = {}
    for name, value in zip(SECRET_NAMES, lines, strict=True):
        try:
            decoded = base64.b64decode(value, validate=True)
        except ValueError as error:
            raise ValueError(f"{name} debe ser Base64 válido.") from error
        if len(decoded) != 32 or base64.b64encode(decoded).decode("ascii") != value:
            raise ValueError(f"{name} debe codificar exactamente 32 bytes en Base64 canónico.")
        secrets[name] = value

    if len(set(secrets.values())) != len(SECRET_NAMES):
        raise ValueError("Cada secreto de monitoreo debe tener un valor independiente.")
    return secrets


def update_env_file(path: pathlib.Path, secrets: dict[str, str]) -> None:
    if not path.is_file():
        raise ValueError("No se encontró deploy/.env.production en la VPS.")

    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if not any(line.startswith(f"{name}=") for name in SECRET_NAMES)
    ]
    lines.extend(f"{name}={secrets[name]}" for name in SECRET_NAMES)
    data = ("\n".join(lines) + "\n").encode("utf-8")
    mode = stat.S_IMODE(path.stat().st_mode)

    fd, temporary_name = tempfile.mkstemp(dir=path.parent, prefix=".env.production.")
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as temporary:
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: sync_monitoring_secrets.py RUTA_ENV_PRODUCCION")
    secrets = read_secrets()
    update_env_file(pathlib.Path(sys.argv[1]), secrets)
    print("Secretos de Grafana y métricas sincronizados.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        raise SystemExit(str(error)) from error
