#!/usr/bin/env python3
"""Atomically sync the mobile JWT signing key into the private production env file."""

from __future__ import annotations

import base64
import os
import pathlib
import stat
import sys
import tempfile


def write_mobile_jwt_secret(env_path: pathlib.Path, encoded_secret: str) -> None:
    try:
        secret = base64.b64decode(encoded_secret, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError("MOBILE_JWT_SECRET debe ser Base64 válido.") from error
    if len(secret) != 32:
        raise ValueError("MOBILE_JWT_SECRET debe codificar exactamente 32 bytes.")
    if not env_path.is_file():
        raise ValueError("No existe el archivo privado .env.production.")

    lines = [line for line in env_path.read_text(encoding="utf-8").splitlines()
             if not line.startswith("MOBILE_JWT_SECRET=")]
    lines.append(f"MOBILE_JWT_SECRET={encoded_secret}")
    data = ("\n".join(lines) + "\n").encode("utf-8")
    mode = stat.S_IMODE(env_path.stat().st_mode)
    fd, temporary_name = tempfile.mkstemp(dir=str(env_path.parent), prefix=".env.production.")
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as temporary:
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, env_path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: sync_mobile_jwt_secret.py RUTA_ENV_PRODUCCION")
    encoded_secret = sys.stdin.readline(129).strip()
    try:
        write_mobile_jwt_secret(pathlib.Path(sys.argv[1]), encoded_secret)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("Clave JWT móvil sincronizada")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
