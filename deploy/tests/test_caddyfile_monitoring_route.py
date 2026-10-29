from __future__ import annotations

import pathlib
import re
import unittest


CADDYFILE = pathlib.Path(__file__).resolve().parents[1] / "Caddyfile"


class MonitoringRouteTests(unittest.TestCase):
    def test_grafana_subpath_is_preserved_for_its_configured_root_url(self) -> None:
        caddyfile = CADDYFILE.read_text(encoding="utf-8")

        self.assertRegex(
            caddyfile,
            re.compile(r"(?ms)^\s*handle /monitoring/\*\s*\{\s*reverse_proxy grafana:3000\s*\}"),
        )
        self.assertNotIn("handle_path /monitoring/*", caddyfile)


if __name__ == "__main__":
    unittest.main()
