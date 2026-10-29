from __future__ import annotations

import base64
import os
import pathlib
import stat
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from deploy.sync_mobile_jwt_secret import write_mobile_jwt_secret


class SyncMobileJwtSecretTest(unittest.TestCase):
    def test_updates_only_jwt_key_and_preserves_file_mode(self) -> None:
        secret = base64.b64encode(b"a" * 32).decode("ascii")
        with tempfile.TemporaryDirectory() as directory:
            env_path = pathlib.Path(directory) / ".env.production"
            env_path.write_text("SITE_DOMAIN=example.test\nMOBILE_JWT_SECRET=old\nMOBILE_JWT_SECRET=duplicate\n")
            env_path.chmod(0o600)

            write_mobile_jwt_secret(env_path, secret)

            self.assertEqual(
                env_path.read_text(),
                f"SITE_DOMAIN=example.test\nMOBILE_JWT_SECRET={secret}\n",
            )
            if os.name == "posix":
                self.assertEqual(stat.S_IMODE(env_path.stat().st_mode), 0o600)

    def test_rejects_invalid_secret_without_modifying_file(self) -> None:
        invalid_secrets = (
            "not-base64!",
            base64.b64encode(b"b" * 31).decode("ascii"),
            base64.b64encode(b"b" * 33).decode("ascii"),
        )
        with tempfile.TemporaryDirectory() as directory:
            env_path = pathlib.Path(directory) / ".env.production"
            original = "SITE_DOMAIN=example.test\nMOBILE_JWT_SECRET=unchanged\n"
            env_path.write_text(original)
            for secret in invalid_secrets:
                with self.subTest(secret_length=len(secret)):
                    with self.assertRaises(ValueError):
                        write_mobile_jwt_secret(env_path, secret)
                    self.assertEqual(env_path.read_text(), original)


if __name__ == "__main__":
    unittest.main()
