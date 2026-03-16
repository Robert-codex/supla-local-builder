import os
import tempfile
import time
import unittest
from pathlib import Path

import local_builder.server as builder_server
from local_builder.server import BuildManager, BuildMetadata, BuildRequest


class _FakeThread:
    started = 0

    def __init__(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
        _FakeThread.started += 0

    def start(self) -> None:
        _FakeThread.started += 1


class BuildManagerForceRebuildTest(unittest.TestCase):
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

        self.original_source_signature = os.environ.get("LOCAL_BUILDER_SOURCE_SIGNATURE")
        self.original_force_rebuild = os.environ.get("LOCAL_BUILDER_FORCE_REBUILD")
        self.original_retention_days = os.environ.get("LOCAL_BUILDER_STALE_RETENTION_DAYS")
        self.original_retention_keep = os.environ.get("LOCAL_BUILDER_STALE_RETENTION_KEEP")
        os.environ["LOCAL_BUILDER_SOURCE_SIGNATURE"] = "sig-test"
        os.environ.pop("LOCAL_BUILDER_FORCE_REBUILD", None)
        os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = "14"
        os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = "3"

        self.original_thread = builder_server.threading.Thread
        builder_server.threading.Thread = _FakeThread  # type: ignore[assignment]

        self.base_payload = {
            "env": "GUI_Generic_ESP32",
            "language": "pl",
            "build_version": "26.03.16",
            "selected_options": ["SUPLA_BUTTON", "SUPLA_RELAY"],
            "template_name": "Sonoff POWR316",
            "template_json": '{"NAME":"Sonoff POWR316","GPIO":[0],"FLAG":0}',
            "public_builder_url": "https://builder.regnal.eu/",
            "custom_name": "",
        }

    def tearDown(self) -> None:
        builder_server.BUILDS_DIR = self.original_builds_dir
        builder_server.WORK_DIR = self.original_work_dir
        builder_server.threading.Thread = self.original_thread  # type: ignore[assignment]
        if self.original_source_signature is None:
            os.environ.pop("LOCAL_BUILDER_SOURCE_SIGNATURE", None)
        else:
            os.environ["LOCAL_BUILDER_SOURCE_SIGNATURE"] = self.original_source_signature
        if self.original_force_rebuild is None:
            os.environ.pop("LOCAL_BUILDER_FORCE_REBUILD", None)
        else:
            os.environ["LOCAL_BUILDER_FORCE_REBUILD"] = self.original_force_rebuild
        if self.original_retention_days is None:
            os.environ.pop("LOCAL_BUILDER_STALE_RETENTION_DAYS", None)
        else:
            os.environ["LOCAL_BUILDER_STALE_RETENTION_DAYS"] = self.original_retention_days
        if self.original_retention_keep is None:
            os.environ.pop("LOCAL_BUILDER_STALE_RETENTION_KEEP", None)
        else:
            os.environ["LOCAL_BUILDER_STALE_RETENTION_KEEP"] = self.original_retention_keep
        self.tmpdir.cleanup()

    def _request(self, force_rebuild: bool = False) -> BuildRequest:
        payload = dict(self.base_payload)
        if force_rebuild:
            payload["force_rebuild"] = True
        return BuildRequest.from_payload(payload)

    def _ready_metadata(self, request: BuildRequest) -> BuildMetadata:
        now = time.time()
        return BuildMetadata(
            hash=request.hash,
            status="ready",
            created_at=now - 30,
            updated_at=now - 10,
            request=request.canonical_payload(),
            log_path=str(self.builds_dir / request.hash / "build.log"),
            platformio_cmd="/usr/bin/pio",
        )

    def test_submit_reuses_ready_cache_by_default(self) -> None:
        manager = BuildManager(catalog=object())  # type: ignore[arg-type]
        request = self._request(force_rebuild=False)
        manager.jobs[request.hash] = self._ready_metadata(request)
        manager.metadata_dirs[request.hash] = self.builds_dir / request.hash

        _FakeThread.started = 0
        result = manager.submit(request)

        self.assertEqual(result.status, "ready")
        self.assertEqual(_FakeThread.started, 0)

    def test_submit_force_rebuild_requeues_ready_cache(self) -> None:
        manager = BuildManager(catalog=object())  # type: ignore[arg-type]
        request = self._request(force_rebuild=True)
        manager.jobs[request.hash] = self._ready_metadata(request)
        manager.metadata_dirs[request.hash] = self.builds_dir / request.hash

        _FakeThread.started = 0
        result = manager.submit(request, force_rebuild=request.force_rebuild)

        self.assertEqual(result.status, "queued")
        self.assertEqual(_FakeThread.started, 1)

    def test_submit_force_rebuild_env_requeues_ready_cache(self) -> None:
        os.environ["LOCAL_BUILDER_FORCE_REBUILD"] = "1"
        manager = BuildManager(catalog=object())  # type: ignore[arg-type]
        request = self._request(force_rebuild=False)
        manager.jobs[request.hash] = self._ready_metadata(request)
        manager.metadata_dirs[request.hash] = self.builds_dir / request.hash

        _FakeThread.started = 0
        result = manager.submit(request)

        self.assertEqual(result.status, "queued")
        self.assertEqual(_FakeThread.started, 1)


if __name__ == "__main__":
    unittest.main()
