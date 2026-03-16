import json
import os
import tempfile
import time
import unittest
from pathlib import Path

import local_builder.server as builder_server
from local_builder.server import BuildManager


class BuildManagerStalePathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        root = Path(self.tmpdir.name)
        self.builds_dir = root / "builds"
        self.work_dir = root / "work"
        self.builds_dir.mkdir(parents=True, exist_ok=True)
        self.work_dir.mkdir(parents=True, exist_ok=True)

        self.original_builds_dir = builder_server.BUILDS_DIR
        self.original_work_dir = builder_server.WORK_DIR
        builder_server.BUILDS_DIR = self.builds_dir
        builder_server.WORK_DIR = self.work_dir

        self.original_retention_days = os.environ.get("LOCAL_BUILDER_STALE_RETENTION_DAYS")
        self.original_retention_keep = os.environ.get("LOCAL_BUILDER_STALE_RETENTION_KEEP")
        os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = "14"
        os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = "3"

        self.build_hash = "f6449db0d23171a84d66a814c59b8967"
        self.stale_dir = self.builds_dir / f"{self.build_hash}.stale.1773680440"
        artifacts_dir = self.stale_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        self.bin_name = "sample.bin"
        (artifacts_dir / self.bin_name).write_bytes(b"firmware")
        (self.stale_dir / "build.log").write_text("platformio output\n", encoding="utf-8")

        metadata = {
            "hash": self.build_hash,
            "status": "ready",
            "created_at": 1773678937.900081,
            "updated_at": 1773679591.9382052,
            "request": {
                "env": "GUI_Generic_ESP32",
                "language": "pl",
                "build_version": "26.03.16",
                "selected_options": [],
                "template_name": "",
                "template_json": "",
                "public_builder_url": "https://builder.regnal.eu/",
                "custom_name": "",
            },
            "artifact_urls": {},
            "artifact_files": {
                "bin": self.bin_name,
            },
            "flash_parts": [],
            "chip_family": "ESP32",
            "log_path": str(self.builds_dir / self.build_hash / "build.log"),
            "error": "",
            "platformio_cmd": "/usr/bin/pio",
        }
        (self.stale_dir / "metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        if self.original_retention_days is None:
            os.environ.pop("LOCAL_BUILDER_STALE_RETENTION_DAYS", None)
        else:
            os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = self.original_retention_days
        if self.original_retention_keep is None:
            os.environ.pop("LOCAL_BUILDER_STALE_RETENTION_KEEP", None)
        else:
            os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = self.original_retention_keep
        builder_server.BUILDS_DIR = self.original_builds_dir
        builder_server.WORK_DIR = self.original_work_dir
        self.tmpdir.cleanup()

    def test_resolve_artifact_uses_stale_directory(self) -> None:
        manager = BuildManager(catalog=object())  # type: ignore[arg-type]
        artifact = manager.resolve_artifact(self.build_hash, "bin")
        self.assertEqual(artifact, self.stale_dir / "artifacts" / self.bin_name)

    def test_resolve_log_path_uses_stale_directory(self) -> None:
        manager = BuildManager(catalog=object())  # type: ignore[arg-type]
        metadata = manager.get(self.build_hash)
        self.assertIsNotNone(metadata)
        log_path = manager.resolve_log_path(self.build_hash, metadata)
        self.assertEqual(log_path, self.stale_dir / "build.log")

    def test_retention_keep_prunes_older_stale_dirs(self) -> None:
        os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = "0"
        os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = "1"

        older_build = self.builds_dir / f"{self.build_hash}.stale.1111111111"
        older_build_artifacts = older_build / "artifacts"
        older_build_artifacts.mkdir(parents=True, exist_ok=True)
        (older_build_artifacts / self.bin_name).write_bytes(b"older")
        (older_build / "build.log").write_text("older log\n", encoding="utf-8")
        metadata = {
            "hash": self.build_hash,
            "status": "ready",
            "created_at": 1773670000.0,
            "updated_at": 1773670000.0,
            "request": {
                "env": "GUI_Generic_ESP32",
                "language": "pl",
                "build_version": "26.03.15",
                "selected_options": [],
                "template_name": "",
                "template_json": "",
                "public_builder_url": "https://builder.regnal.eu/",
                "custom_name": "",
            },
            "artifact_urls": {},
            "artifact_files": {"bin": self.bin_name},
            "flash_parts": [],
            "chip_family": "ESP32",
            "log_path": str(older_build / "build.log"),
            "error": "",
            "platformio_cmd": "/usr/bin/pio",
        }
        (older_build / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        older_work = self.work_dir / f"{self.build_hash}.stale.1111111111"
        newer_work = self.work_dir / f"{self.build_hash}.stale.2222222222"
        older_work.mkdir(parents=True, exist_ok=True)
        newer_work.mkdir(parents=True, exist_ok=True)

        now = time.time()
        old_ts = now - 1000
        new_ts = now - 10
        for path in (older_build, older_build / "metadata.json", older_work):
            os.utime(path, (old_ts, old_ts))
        for path in (self.stale_dir, self.stale_dir / "metadata.json", newer_work):
            os.utime(path, (new_ts, new_ts))

        manager = BuildManager(catalog=object())  # type: ignore[arg-type]

        self.assertFalse(older_build.exists())
        self.assertTrue(self.stale_dir.exists())
        self.assertFalse(older_work.exists())
        self.assertTrue(newer_work.exists())
        self.assertIsNotNone(manager.get(self.build_hash))

    def test_retention_days_prunes_expired_stale_dirs(self) -> None:
        os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = "1"
        os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = "10"

        old_ts = time.time() - (3 * 24 * 60 * 60)
        os.utime(self.stale_dir, (old_ts, old_ts))
        os.utime(self.stale_dir / "metadata.json", (old_ts, old_ts))
        os.utime(self.stale_dir / "build.log", (old_ts, old_ts))

        manager = BuildManager(catalog=object())  # type: ignore[arg-type]

        self.assertFalse(self.stale_dir.exists())
        self.assertIsNone(manager.get(self.build_hash))


if __name__ == "__main__":
    unittest.main()
