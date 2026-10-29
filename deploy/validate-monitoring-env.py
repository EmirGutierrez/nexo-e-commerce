from __future__ import annotations

import os
import pathlib
import re
import stat
import sys


SECRET_NAMES = ("PROMETHEUS_SCRAPE_TOKEN", "GRAFANA_ADMIN_PASSWORD")
HEX_SECRET = re.compile(r"[0-9a-fA-F]{64}\Z")


def validate(path: pathlib.Path) -> None:
    if os.name != "nt" and stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError(f"{path.name} debe tener permisos 600 o más restrictivos.")

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        name, value = line.split("=", maxsplit=1)
        name = name.strip()
        if name not in SECRET_NAMES:
            continue
        if name in values:
            raise ValueError(f"{name} aparece más de una vez en {path.name}.")
        values[name] = value.strip()

    for name in SECRET_NAMES:
        if not HEX_SECRET.fullmatch(values.get(name, "")):
            raise ValueError(
                f"{name} debe contener un valor hexadecimal aleatorio de 64 caracteres."
            )

    if values[SECRET_NAMES[0]].lower() == values[SECRET_NAMES[1]].lower():
        raise ValueError("Los secretos de Prometheus y Grafana deben ser distintos.")


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: validate-monitoring-env.py RUTA_ENV", file=sys.stderr)
        return 2

    path = pathlib.Path(sys.argv[1])
    try:
        validate(path)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"Configuración de monitoreo no válida: {error}", file=sys.stderr)
        return 1

    print("Secretos de monitoreo válidos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
