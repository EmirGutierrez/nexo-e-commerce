#!/usr/bin/env python3
"""Restrict the GitHub Actions SSH key to the NEXO deployment wrapper."""

from __future__ import annotations

import base64
import os
import pathlib
import pwd
import re
import sys
import tempfile


def main() -> int:
    if os.geteuid() == 0:
        raise SystemExit("La llave de despliegue no debe usar root.")
    if len(sys.argv) != 2:
        raise SystemExit("Uso: restrict-deploy-key.py RUTA_WRAPPER")

    public_key = sys.stdin.readline().strip().split()
    if len(public_key) < 2:
        raise SystemExit("No se recibió la llave pública de despliegue.")
    key_type, key_blob = public_key[:2]
    if not re.fullmatch(r"(?:ssh-(?:ed25519|rsa|dss)|ecdsa-sha2-nistp\d+|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)", key_type):
        raise SystemExit("Tipo de llave pública SSH no permitido.")
    try:
        base64.b64decode(key_blob, validate=True)
    except ValueError as error:
        raise SystemExit("Formato de llave pública SSH inválido.") from error

    home = pathlib.Path(pwd.getpwuid(os.geteuid()).pw_dir)
    wrapper = pathlib.Path(sys.argv[1]).resolve(strict=True)
    if wrapper.parent != (home / ".local" / "bin").resolve(strict=True):
        raise SystemExit("La ruta del wrapper debe estar en ~/.local/bin.")

    ssh_dir = home / ".ssh"
    ssh_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(ssh_dir, 0o700)
    authorized_keys = ssh_dir / "authorized_keys"
    existing = authorized_keys.read_text(encoding="utf-8").splitlines() if authorized_keys.exists() else []
    preserved = [line for line in existing if key_blob not in line.split()]
    escaped_wrapper = str(wrapper).replace("\\", "\\\\").replace('"', '\\"')
    preserved.append(f'restrict,command="{escaped_wrapper}" {key_type} {key_blob} nexo-github-deploy')

    fd, temporary_name = tempfile.mkstemp(prefix=".authorized_keys.", dir=ssh_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as temporary:
            temporary.write("\n".join(preserved) + "\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, authorized_keys)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

    print("Llave SSH de GitHub limitada al wrapper de despliegue.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
