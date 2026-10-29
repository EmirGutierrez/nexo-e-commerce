#!/usr/bin/env python3
"""Write the fixed, least-route WireGuard server configuration atomically."""

from __future__ import annotations

import base64
import binascii
import os
import pathlib
import subprocess
import sys
import tempfile


def decode_key(value: str, label: str) -> bytes:
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as error:
        raise SystemExit(f"Clave {label} WireGuard inválida.") from error
    if len(decoded) != 32 or base64.b64encode(decoded).decode("ascii") != value:
        raise SystemExit(f"Clave {label} WireGuard inválida.")
    return decoded


def render_config(private_key: str, peer_public_key: str) -> bytes:
    decode_key(private_key, "privada")
    decode_key(peer_public_key, "pública")
    return (
        "[Interface]\n"
        "Address = 10.77.0.1/24\n"
        "ListenPort = 51820\n"
        f"PrivateKey = {private_key}\n"
        "PostUp = iptables -C INPUT -p udp --dport 51820 -j ACCEPT || iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT\n"
        "PostDown = iptables -D INPUT -p udp --dport 51820 -j ACCEPT || true\n"
        "\n"
        "[Peer]\n"
        f"PublicKey = {peer_public_key}\n"
        "AllowedIPs = 10.77.0.2/32\n"
    ).encode("utf-8")


def private_key_from_config(path: pathlib.Path) -> str | None:
    if not path.exists():
        return None
    if path.is_symlink():
        raise SystemExit("La configuración WireGuard existente no es válida.")
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("PrivateKey = "):
            private_key = line.removeprefix("PrivateKey = ").strip()
            decode_key(private_key, "privada existente")
            return private_key
    raise SystemExit("La configuración WireGuard existente no contiene una llave privada.")


def generate_server_private_key() -> str:
    image = "nexo-wireguard-keygen:local"
    context = pathlib.Path(__file__).with_name("wireguard")
    try:
        subprocess.run(
            ["docker", "build", "--quiet", "--tag", image, str(context)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        result = subprocess.run(
            ["docker", "run", "--rm", "--network", "none", "--entrypoint", "/usr/bin/wg", image, "genkey"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit("No se pudo generar la llave privada WireGuard en la VPS.") from error
    finally:
        subprocess.run(
            ["docker", "image", "rm", "--force", image],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    private_key = result.stdout.strip()
    decode_key(private_key, "privada generada")
    return private_key


def write_config(path: pathlib.Path, data: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    fd, temporary_path = tempfile.mkstemp(prefix=".wg0.", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as temporary:
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: sync-wireguard-config.py RUTA_CONFIG")
    peer_public_key = sys.stdin.readline().strip()
    if sys.stdin.read().strip():
        raise SystemExit("Entrada WireGuard inválida.")
    path = pathlib.Path(sys.argv[1])
    private_key = private_key_from_config(path) or generate_server_private_key()
    config = render_config(private_key, peer_public_key)
    write_config(path, config)
    print("Configuración WireGuard restringida a la IP del runner.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
