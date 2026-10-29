from __future__ import annotations

import base64
import os
import pathlib
import stat
import tempfile
import unittest
import importlib.util


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "sync-wireguard-config.py"
SPEC = importlib.util.spec_from_file_location("sync_wireguard_config", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
CONFIG = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONFIG)


def encoded_key(start: int) -> str:
    return base64.b64encode(bytes(range(start, start + 32))).decode("ascii")


class WireGuardConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.private_key = encoded_key(0)
        self.peer_public_key = encoded_key(32)

    def test_config_has_fixed_server_and_peer_routes(self) -> None:
        config = CONFIG.render_config(self.private_key, self.peer_public_key)

        self.assertIn(b"Address = 10.77.0.1/24", config)
        self.assertIn(b"ListenPort = 51820", config)
        self.assertIn(b"AllowedIPs = 10.77.0.2/32", config)
        self.assertNotIn(b"0.0.0.0/0", config)
        self.assertNotIn(b"::/0", config)

    def test_rejects_noncanonical_or_wrong_length_keys(self) -> None:
        with self.assertRaises(SystemExit):
            CONFIG.render_config("invalid", self.peer_public_key)
        with self.assertRaises(SystemExit):
            CONFIG.render_config(self.private_key, base64.b64encode(b"short").decode("ascii"))

    def test_reuses_server_private_key_from_existing_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = pathlib.Path(temporary_directory) / "wg0.conf"
            path.write_bytes(CONFIG.render_config(self.private_key, self.peer_public_key))

            self.assertEqual(CONFIG.private_key_from_config(path), self.private_key)

    def test_missing_configuration_has_no_server_private_key_to_reuse(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = pathlib.Path(temporary_directory) / "missing.conf"

            self.assertIsNone(CONFIG.private_key_from_config(path))

    def test_rejects_existing_configuration_without_private_key(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = pathlib.Path(temporary_directory) / "wg0.conf"
            path.write_text("[Interface]\nAddress = 10.77.0.1/24\n", encoding="utf-8")

            with self.assertRaises(SystemExit):
                CONFIG.private_key_from_config(path)

    @unittest.skipIf(os.name == "nt", "WireGuard server runs on Linux POSIX permissions")
    def test_writes_config_with_private_permissions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = pathlib.Path(temporary_directory) / "wireguard" / "wg0.conf"
            config = CONFIG.render_config(self.private_key, self.peer_public_key)
            CONFIG.write_config(path, config)

            self.assertEqual(path.read_bytes(), config)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)


if __name__ == "__main__":
    unittest.main()
