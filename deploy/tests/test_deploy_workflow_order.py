from __future__ import annotations

import pathlib
import unittest


REPOSITORY_ROOT = pathlib.Path(__file__).resolve().parents[2]


class DeployWorkflowOrderTest(unittest.TestCase):
    def test_remote_compose_checks_run_after_production_secrets_are_synced(self) -> None:
        workflow = (REPOSITORY_ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        deploy_job = workflow.split("\n  deploy:\n", maxsplit=1)[1]

        steps = (
            "Limitar la llave SSH de despliegue",
            "Sincronizar clave MFA con la VPS",
            "Sincronizar clave JWT móvil con la VPS",
            "Sincronizar token del túnel",
            "Confirmar conectividad SSH por WireGuard",
            "Actualizar aplicación en la VPS",
        )
        positions = [deploy_job.index(step) for step in steps]
        self.assertEqual(positions, sorted(positions))

        mobile_secret_sync = deploy_job.index('"$VPS_USER@$NEXO_SSH_HOST" sync-mobile-jwt')
        health_check = deploy_job.index('"$VPS_USER@$NEXO_SSH_HOST" health')
        wireguard_key_check = deploy_job.index('"$VPS_USER@$NEXO_SSH_HOST" wireguard-public-key')
        self.assertLess(mobile_secret_sync, health_check)
        self.assertLess(mobile_secret_sync, wireguard_key_check)

    def test_monitoring_failure_cannot_block_caddy_or_hide_init_logs(self) -> None:
        compose = (REPOSITORY_ROOT / "compose.prod.yaml").read_text(encoding="utf-8")
        caddy = compose.split("\n  caddy:\n", maxsplit=1)[1].split("\n  prometheus:\n", maxsplit=1)[0]
        self.assertIn("frontend:", caddy)
        self.assertNotIn("grafana:", caddy)

        command = (REPOSITORY_ROOT / "deploy/nexo-ssh-command.sh").read_text(encoding="utf-8")
        recovery = command.split("if ! docker compose", maxsplit=1)[1].split("\n  fi", maxsplit=1)[0]
        self.assertIn("up -d --no-deps caddy", recovery)
        self.assertIn("logs --tail=100 postgres-exporter-init", recovery)


if __name__ == "__main__":
    unittest.main()
