from __future__ import annotations

import importlib.util
import pathlib
import unittest
from unittest import mock


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "validate-monitoring-env.py"
SPEC = importlib.util.spec_from_file_location("validate_monitoring_env", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class MonitoringEnvironmentTests(unittest.TestCase):
    class InMemoryEnvironmentFile:
        name = ".env.production"

        def __init__(self, content: str, mode: int = 0o600) -> None:
            self.content = content
            self.mode = mode

        def stat(self) -> object:
            return type("FileStat", (), {"st_mode": self.mode})()

        def read_text(self, encoding: str) -> str:
            return self.content

    def validate_text(self, text: str) -> None:
        VALIDATOR.validate(self.InMemoryEnvironmentFile(text))

    def test_accepts_distinct_64_character_hex_secrets(self) -> None:
        self.validate_text(
            "PROMETHEUS_SCRAPE_TOKEN=" + "a" * 64 + "\n"
            "GRAFANA_ADMIN_PASSWORD=" + "b" * 64 + "\n"
        )

    def test_rejects_missing_or_placeholder_secrets(self) -> None:
        with self.assertRaisesRegex(ValueError, "PROMETHEUS_SCRAPE_TOKEN"):
            self.validate_text("GRAFANA_ADMIN_PASSWORD=" + "b" * 64 + "\n")

        with self.assertRaisesRegex(ValueError, "GRAFANA_ADMIN_PASSWORD"):
            self.validate_text(
                "PROMETHEUS_SCRAPE_TOKEN=" + "a" * 64 + "\n"
                "GRAFANA_ADMIN_PASSWORD=replace-with-a-random-password\n"
            )

    def test_rejects_reused_secrets_and_duplicate_definitions(self) -> None:
        secret = "a" * 64
        with self.assertRaisesRegex(ValueError, "deben ser distintos"):
            self.validate_text(
                f"PROMETHEUS_SCRAPE_TOKEN={secret}\nGRAFANA_ADMIN_PASSWORD={secret}\n"
            )

        with self.assertRaisesRegex(ValueError, "más de una vez"):
            self.validate_text(
                f"PROMETHEUS_SCRAPE_TOKEN={secret}\n"
                f"PROMETHEUS_SCRAPE_TOKEN={secret}\n"
                "GRAFANA_ADMIN_PASSWORD=" + "b" * 64 + "\n"
            )

    def test_requires_private_permissions_on_the_production_environment_file(self) -> None:
        content = (
            "PROMETHEUS_SCRAPE_TOKEN=" + "a" * 64 + "\n"
            "GRAFANA_ADMIN_PASSWORD=" + "b" * 64 + "\n"
        )
        env_file = self.InMemoryEnvironmentFile(content, mode=0o644)

        with mock.patch.object(VALIDATOR.os, "name", "posix"):
            with self.assertRaisesRegex(ValueError, "permisos 600"):
                VALIDATOR.validate(env_file)

            env_file.mode = 0o600
            VALIDATOR.validate(env_file)


if __name__ == "__main__":
    unittest.main()
