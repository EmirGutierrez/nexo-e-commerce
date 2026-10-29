from __future__ import annotations

import importlib.util
import os
import pathlib
import stat
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "validate-monitoring-env.py"
SPEC = importlib.util.spec_from_file_location("validate_monitoring_env", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class MonitoringEnvironmentTests(unittest.TestCase):
    def validate_text(self, text: str) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            env_path = pathlib.Path(temporary_directory) / ".env.production"
            env_path.write_text(text, encoding="utf-8")
            if os.name != "nt":
                env_path.chmod(0o600)
            VALIDATOR.validate(env_path)

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

    @unittest.skipIf(os.name == "nt", "Permisos POSIX se validan en Linux")
    def test_requires_private_permissions_on_the_production_environment_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            env_path = pathlib.Path(temporary_directory) / ".env.production"
            env_path.write_text(
                "PROMETHEUS_SCRAPE_TOKEN=" + "a" * 64 + "\n"
                "GRAFANA_ADMIN_PASSWORD=" + "b" * 64 + "\n",
                encoding="utf-8",
            )

            env_path.chmod(0o644)
            with self.assertRaisesRegex(ValueError, "permisos 600"):
                VALIDATOR.validate(env_path)

            env_path.chmod(0o600)
            VALIDATOR.validate(env_path)


if __name__ == "__main__":
    unittest.main()
