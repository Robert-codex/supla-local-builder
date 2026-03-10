#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import ssl
import subprocess
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from serial.tools import list_ports as serial_list_ports
except ImportError:
    serial_list_ports = None

ROOT_DIR = Path(__file__).resolve().parent.parent
GUI_GENERIC_DIR = ROOT_DIR / "external" / "GUI-Generic"
STATIC_DIR = Path(__file__).resolve().parent / "static"
DATA_DIR = Path(__file__).resolve().parent / "data"
BUILDS_DIR = DATA_DIR / "builds"
WORK_DIR = DATA_DIR / "work"

LOCAL_TEMPLATE_BOARDS = [
    {
        "NAME": "Sonoff 4CHPROR3 Switch Module (M0802010004)",
        "GPIO": [17, 255, 255, 255, 23, 22, 18, 19, 21, 56, 20, 24, 0],
        "FLAG": 0,
        "BASE": 23,
    },
    {
        "NAME": "Sonoff 4CHPROR3",
        "GPIO": [17, 255, 255, 255, 23, 22, 18, 19, 21, 56, 20, 24, 0],
        "FLAG": 0,
        "BASE": 23,
    }
]


def ensure_dirs() -> None:
    for path in (DATA_DIR, BUILDS_DIR, WORK_DIR):
        path.mkdir(parents=True, exist_ok=True)


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler: BaseHTTPRequestHandler, status: int, payload: str) -> None:
    body = payload.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def guess_mime(path: Path) -> str:
    if path.suffix == ".html":
        return "text/html; charset=utf-8"
    if path.suffix == ".css":
        return "text/css; charset=utf-8"
    if path.suffix == ".js":
        return "application/javascript; charset=utf-8"
    if path.suffix == ".json":
        return "application/json; charset=utf-8"
    if path.suffix == ".bin":
        return "application/octet-stream"
    if path.suffix == ".gz":
        return "application/gzip"
    return "application/octet-stream"


def normalize_public_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    return value.rstrip("/") + "/"


def make_device_basename(custom_name: str, template_name: str, fallback: str) -> str:
    raw = (custom_name or template_name or fallback).strip()
    tokens = re.findall(r"[A-Za-z0-9]+", raw)
    if not tokens:
        return fallback
    first = tokens[0].lower()
    rest = "".join(token[:1].upper() + token[1:] for token in tokens[1:])
    return f"{first}{rest}"


def artifact_filename(base_name: str, kind: str, source: Path) -> str:
    if kind == "bin":
        return f"{base_name}.bin"
    if kind == "factory":
        return f"{base_name}.factory.bin"
    if kind == "gz":
        return f"{base_name}.bin.gz"
    if kind == "bootloader":
        return f"{base_name}.bootloader.bin"
    if kind == "partitions":
        return f"{base_name}.partitions.bin"
    if kind == "boot_app0":
        return f"{base_name}.boot_app0.bin"
    return f"{base_name}.{source.name}"


def list_serial_ports() -> list[dict[str, str]]:
    ports: list[dict[str, str]] = []
    seen_paths: set[str] = set()
    by_id_labels: dict[str, str] = {}

    by_id_dir = Path("/dev/serial/by-id")
    if by_id_dir.exists():
        for entry in sorted(by_id_dir.iterdir(), key=lambda item: item.name):
            try:
                target = str(entry.resolve())
            except OSError:
                continue
            by_id_labels[target] = entry.name

    if serial_list_ports is not None:
        for port in sorted(serial_list_ports.comports(), key=lambda item: item.device):
            path = str(port.device)
            if not path or path in seen_paths:
                continue
            seen_paths.add(path)
            label_parts = [path]
            if port.description and port.description != "n/a":
                label_parts.append(port.description)
            by_id = by_id_labels.get(path)
            if by_id:
                label_parts.append(by_id)
            ports.append(
                {
                    "path": path,
                    "label": " | ".join(label_parts),
                    "source": "pyserial",
                }
            )

    for pattern in ("/dev/ttyUSB*", "/dev/ttyACM*", "/dev/cu.usb*", "/dev/tty.usb*"):
        for entry in sorted(Path("/").glob(pattern.lstrip("/")), key=lambda item: str(item)):
            path = str(entry)
            if path in seen_paths:
                continue
            seen_paths.add(path)
            label = path
            by_id = by_id_labels.get(path)
            if by_id:
                label = f"{path} | {by_id}"
            ports.append(
                {
                    "path": path,
                    "label": label,
                    "source": "filesystem",
                }
            )

    return ports


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def discover_platformio_executable() -> str | None:
    override = os.environ.get("PLATFORMIO_CMD", "").strip()
    if override:
        return override
    local_candidates = (
        ROOT_DIR / "scripts" / "platformio_local.sh",
        ROOT_DIR / ".venv-local-builder" / "bin" / "platformio",
        ROOT_DIR / ".venv-local-builder" / "bin" / "pio",
        ROOT_DIR / ".venv" / "bin" / "platformio",
        ROOT_DIR / ".venv" / "bin" / "pio",
    )
    for candidate in local_candidates:
        if candidate.exists():
            return str(candidate)
    for candidate in ("platformio", "pio"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def parse_env_names(platformio_ini: Path) -> list[str]:
    envs: list[str] = []
    pattern = re.compile(r"^\[env:(.+)\]\s*$")
    for line in platformio_ini.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line.strip())
        if match:
            envs.append(match.group(1))
    return envs


def replace_multiline_option(content: str, section: str, option: str, new_lines: list[str]) -> str:
    lines = content.splitlines()
    output: list[str] = []
    in_section = False
    replaced = False
    skipping = False

    def option_line(value: str) -> bool:
        return value.startswith(f"{option} =") or value.startswith(f"{option}=")

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("[") and stripped.endswith("]"):
            if in_section and not replaced:
                output.extend(new_lines)
                replaced = True
            in_section = stripped == f"[{section}]"
            skipping = False
            output.append(line)
            i += 1
            continue

        if skipping:
            if stripped.startswith("[") and stripped.endswith("]"):
                skipping = False
                continue
            if stripped and not line[:1].isspace() and not stripped.startswith((";", "#")):
                skipping = False
                continue
            i += 1
            continue

        if in_section and option_line(stripped):
            output.extend(new_lines)
            replaced = True
            skipping = True
            i += 1
            continue

        output.append(line)
        i += 1

    if in_section and not replaced:
        output.extend(new_lines)

    return "\n".join(output) + "\n"


@dataclass
class BuildRequest:
    env: str
    language: str
    build_version: str
    selected_options: list[str]
    template_name: str = ""
    template_json: str = ""
    public_builder_url: str = ""
    custom_name: str = ""
    hash: str = ""

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "BuildRequest":
        selected_options = sorted(set(payload.get("selected_options", [])))
        template_json = payload.get("template_json", "")
        if not template_json and payload.get("template_name"):
            template_json = payload.get("template_json_resolved", "")
        public_builder_url = normalize_public_url(payload.get("public_builder_url", ""))
        build_version = payload.get("build_version", "").strip() or datetime.now().strftime("%y.%m.%d")
        custom_name = payload.get("custom_name", "").strip()
        request = cls(
            env=payload.get("env", "").strip(),
            language=payload.get("language", "pl").strip() or "pl",
            build_version=build_version,
            selected_options=selected_options,
            template_name=payload.get("template_name", "").strip(),
            template_json=template_json.strip(),
            public_builder_url=public_builder_url,
            custom_name=custom_name,
        )
        request.hash = request.compute_hash()
        return request

    def canonical_payload(self) -> dict[str, Any]:
        return {
            "env": self.env,
            "language": self.language,
            "build_version": self.build_version,
            "selected_options": self.selected_options,
            "template_name": self.template_name,
            "template_json": self.template_json,
            "public_builder_url": self.public_builder_url,
            "custom_name": self.custom_name,
        }

    def compute_hash(self) -> str:
        canonical = json.dumps(
            self.canonical_payload(),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.md5(canonical.encode("utf-8")).hexdigest()


@dataclass
class BuildMetadata:
    hash: str
    status: str
    created_at: float
    updated_at: float
    request: dict[str, Any]
    artifact_urls: dict[str, str] = field(default_factory=dict)
    artifact_files: dict[str, str] = field(default_factory=dict)
    flash_parts: list[dict[str, str]] = field(default_factory=list)
    chip_family: str = ""
    log_path: str = ""
    error: str = ""
    platformio_cmd: str = ""

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["created_at_iso"] = datetime.fromtimestamp(self.created_at).isoformat()
        payload["updated_at_iso"] = datetime.fromtimestamp(self.updated_at).isoformat()
        return payload


class BuilderCatalog:
    def __init__(self, gui_generic_dir: Path) -> None:
        self.gui_generic_dir = gui_generic_dir
        self.builder_data = load_json(gui_generic_dir / "builder.json")
        upstream_template_boards = load_json(gui_generic_dir / "template_boards.json")
        self.template_boards = self._merge_template_boards(upstream_template_boards, LOCAL_TEMPLATE_BOARDS)
        self.section_labels = self.builder_data.get("SECTIONS", {})
        self.section_keys = [key for key in self.builder_data.keys() if key not in ("version", "Opis struktury", "SECTIONS")]
        self.option_index = self._index_options()
        self.envs = parse_env_names(gui_generic_dir / "platformio.ini")

    def _merge_template_boards(
        self,
        upstream_template_boards: list[dict[str, Any]],
        local_template_boards: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        merged = list(upstream_template_boards)
        known_names = {str(template.get("NAME", "")) for template in merged}
        for template in local_template_boards:
            name = str(template.get("NAME", ""))
            if name and name not in known_names:
                merged.append(template)
                known_names.add(name)
        return merged

    def _index_options(self) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for section in self.section_keys:
            for option_id, meta in self.builder_data.get(section, {}).items():
                result[option_id] = {"section": section, **meta}
        return result

    def resolve_template_json(self, template_name: str) -> str:
        if not template_name:
            return ""
        for template in self.template_boards:
            if template.get("NAME") == template_name:
                return json.dumps(template, ensure_ascii=False, separators=(",", ":"))
        return ""

    def extra_flags_for_option(self, option_id: str) -> list[str]:
        meta = self.option_index.get(option_id, {})
        raw = str(meta.get("opts", "")).strip()
        if not raw:
            return []
        flags: list[str] = []
        for token in [item.strip() for item in raw.split(",") if item.strip()]:
            if token.startswith("-D") or token.startswith("-l"):
                flags.append(token)
            elif "=" in token or token.startswith(("ARDUINO_", "CORE_", "ZIGBEE_", "JSON_")):
                flags.append(f"-D {token}")
            else:
                flags.append(f"-l{token}")
        return flags

    def extra_libs_for_option(self, option_id: str) -> list[str]:
        meta = self.option_index.get(option_id, {})
        raw = str(meta.get("libs", "")).strip()
        if not raw:
            return []
        return [item.strip() for item in raw.split(",") if item.strip()]

    def default_enabled_options(self) -> list[str]:
        return sorted(
            option_id
            for option_id, meta in self.option_index.items()
            if bool(meta.get("defOn"))
        )

    def api_payload(self) -> dict[str, Any]:
        return {
            "version": self.builder_data.get("version"),
            "sections": self.section_keys,
            "section_labels": self.section_labels,
            "options": {key: self.option_index[key] for key in sorted(self.option_index.keys())},
            "templates": self.template_boards,
            "envs": self.envs,
            "defaults": {
                "language": "pl",
                "env": self.envs[0] if self.envs else "",
                "selected_options": self.default_enabled_options(),
            },
        }


class BuildManager:
    def __init__(self, catalog: BuilderCatalog) -> None:
        self.catalog = catalog
        self.platformio_cmd = discover_platformio_executable()
        self.lock = threading.Lock()
        self.jobs: dict[str, BuildMetadata] = {}
        self.active_jobs: set[str] = set()
        self._load_metadata()

    def _metadata_path(self, build_hash: str) -> Path:
        return BUILDS_DIR / build_hash / "metadata.json"

    def _log_path(self, build_hash: str) -> Path:
        return BUILDS_DIR / build_hash / "build.log"

    def _artifacts_dir(self, build_hash: str) -> Path:
        return BUILDS_DIR / build_hash / "artifacts"

    def _work_project_dir(self, build_hash: str) -> Path:
        return WORK_DIR / build_hash / "project"

    def _load_metadata(self) -> None:
        for metadata_path in BUILDS_DIR.glob("*/metadata.json"):
            payload = load_json(metadata_path)
            metadata = BuildMetadata(
                hash=payload["hash"],
                status=payload["status"],
                created_at=payload["created_at"],
                updated_at=payload["updated_at"],
                request=payload["request"],
                artifact_urls=payload.get("artifact_urls", {}),
                artifact_files=payload.get("artifact_files", {}),
                flash_parts=payload.get("flash_parts", []),
                chip_family=payload.get("chip_family", ""),
                log_path=payload.get("log_path", ""),
                error=payload.get("error", ""),
                platformio_cmd=payload.get("platformio_cmd", ""),
            )
            if metadata.status in {"queued", "building"}:
                metadata.status = "failed"
                if not metadata.error:
                    metadata.error = "Build został przerwany albo serwer został zrestartowany przed zakończeniem kompilacji."
                self._persist_best_effort(metadata)
            self.jobs[metadata.hash] = metadata

    def _persist(self, metadata: BuildMetadata) -> None:
        metadata.updated_at = time.time()
        save_json(self._metadata_path(metadata.hash), metadata.to_dict())

    def _persist_best_effort(self, metadata: BuildMetadata) -> None:
        try:
            self._persist(metadata)
        except OSError:
            return

    def list_builds(self) -> list[dict[str, Any]]:
        with self.lock:
            ordered = sorted(self.jobs.values(), key=lambda item: item.updated_at, reverse=True)
            return [item.to_dict() for item in ordered[:25]]

    def get(self, build_hash: str) -> BuildMetadata | None:
        with self.lock:
            return self.jobs.get(build_hash)

    def ensure_flash_parts(self, metadata: BuildMetadata) -> list[dict[str, str]]:
        if metadata.status != "ready":
            return metadata.flash_parts

        request = BuildRequest.from_payload(metadata.request)
        request.hash = metadata.hash
        artifact_files = dict(metadata.artifact_files)
        refreshed_files = self._refresh_artifact_files(request, artifact_files)
        if refreshed_files:
            artifact_files = refreshed_files

        flash_parts = self._build_flash_parts(request, artifact_files)
        if not flash_parts:
            return []

        with self.lock:
            current = self.jobs.get(metadata.hash)
            if current is None:
                return flash_parts
            current.artifact_files = artifact_files
            current.flash_parts = flash_parts
            if not current.chip_family:
                current.chip_family = self._chip_family_for_env(request.env)
            self._persist_best_effort(current)
            return current.flash_parts

    def _refresh_artifact_files(self, request: BuildRequest, artifact_files: dict[str, str]) -> dict[str, str]:
        work_project = self._work_project_dir(request.hash)
        if not work_project.exists():
            return artifact_files

        available_artifacts = self._collect_artifacts(request, work_project)
        if not available_artifacts:
            return artifact_files

        artifact_dir = self._artifacts_dir(request.hash)
        artifact_dir.mkdir(parents=True, exist_ok=True)
        base_name = make_device_basename(request.custom_name, request.template_name, request.hash)

        updated = dict(artifact_files)
        for kind, source in available_artifacts.items():
            if kind in updated:
                continue
            target = artifact_dir / artifact_filename(base_name, kind, source)
            try:
                shutil.copy2(source, target)
                updated[kind] = target.name
            except OSError:
                updated[kind] = source.name
        return updated

    def submit(self, request: BuildRequest) -> BuildMetadata:
        with self.lock:
            existing = self.jobs.get(request.hash)
            if existing and existing.status in {"queued", "building", "ready"}:
                return existing

            now = time.time()
            metadata = BuildMetadata(
                hash=request.hash,
                status="queued",
                created_at=existing.created_at if existing else now,
                updated_at=now,
                request=request.canonical_payload(),
                log_path=str(self._log_path(request.hash)),
                chip_family=self._chip_family_for_env(request.env),
                platformio_cmd=self.platformio_cmd or "",
            )
            self.jobs[request.hash] = metadata
            build_dir = BUILDS_DIR / request.hash
            build_dir.mkdir(parents=True, exist_ok=True)
            self._artifacts_dir(request.hash).mkdir(parents=True, exist_ok=True)
            self._persist(metadata)

        thread = threading.Thread(target=self._run_build, args=(request,), daemon=True)
        thread.start()
        return metadata

    def compatibility_status(self, build_hash: str, current_version: str) -> str:
        metadata = self.get(build_hash)
        if metadata is None:
            return "UNKNOWN"
        if metadata.status in {"queued", "building"}:
            return "WAIT"
        if metadata.status == "failed":
            return "ERROR"
        build_version = str(metadata.request.get("build_version", ""))
        if current_version and current_version == build_version:
            return "NONE"
        return "READY"

    def resolve_artifact(self, build_hash: str, requested_type: str) -> Path | None:
        metadata = self.get(build_hash)
        if metadata is None or metadata.status != "ready":
            return None
        aliases = {
            "bootloader.bin": "bootloader",
            "partitions.bin": "partitions",
            "boot_app0.bin": "boot_app0",
        }
        lookup_type = aliases.get(requested_type, requested_type)
        if requested_type == "factory" and "factory" not in metadata.artifact_files:
            lookup_type = "bin"
        elif requested_type == "bin" and "bin" not in metadata.artifact_files and "factory" in metadata.artifact_files:
            lookup_type = "factory"

        filename = metadata.artifact_files.get(lookup_type)
        if filename:
            path = self._artifacts_dir(build_hash) / filename
            if path.exists():
                return path

        request = BuildRequest.from_payload(metadata.request)
        request.hash = build_hash
        work_project = self._work_project_dir(build_hash)
        if not work_project.exists():
            return None
        artifacts = self._collect_artifacts(request, work_project)
        return artifacts.get(requested_type) or artifacts.get(lookup_type)

    def _run_build(self, request: BuildRequest) -> None:
        with self.lock:
            metadata = self.jobs[request.hash]
            metadata.status = "building"
            metadata.error = ""
            self.active_jobs.add(request.hash)
            self._persist(metadata)

        try:
            if not self.platformio_cmd:
                raise RuntimeError("Nie znaleziono PlatformIO. Ustaw `PLATFORMIO_CMD` albo zainstaluj `platformio`/`pio`.")

            work_project = self._work_project_dir(request.hash)
            if work_project.parent.exists():
                shutil.rmtree(work_project.parent)
            work_project.parent.mkdir(parents=True, exist_ok=True)

            shutil.copytree(
                GUI_GENERIC_DIR,
                work_project,
                ignore=shutil.ignore_patterns(".git", ".pio", "build_output", "__pycache__"),
            )

            generated_config = self._generate_platformio_ini(request)
            (work_project / "platformio.ini").write_text(generated_config, encoding="utf-8")
            (work_project / ".local-builder-request.json").write_text(
                json.dumps(request.canonical_payload(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            log_path = self._log_path(request.hash)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("w", encoding="utf-8") as log_file:
                command = [self.platformio_cmd, "run", "-e", request.env]
                process = subprocess.run(
                    command,
                    cwd=work_project,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    text=True,
                    check=False,
                )
            if process.returncode != 0:
                raise RuntimeError(f"Kompilacja zakończyła się kodem {process.returncode}. Sprawdź build.log.")

            artifacts = self._collect_artifacts(request, work_project)
            if "bin" not in artifacts:
                raise RuntimeError("Kompilacja zakończyła się bez pliku `.bin`.")

            artifact_dir = self._artifacts_dir(request.hash)
            artifact_dir.mkdir(parents=True, exist_ok=True)
            copied_files: dict[str, str] = {}
            base_name = make_device_basename(request.custom_name, request.template_name, request.hash)
            for kind, source in artifacts.items():
                target = artifact_dir / artifact_filename(base_name, kind, source)
                shutil.copy2(source, target)
                copied_files[kind] = target.name

            flash_parts = self._build_flash_parts(request, copied_files)

            with self.lock:
                metadata = self.jobs[request.hash]
                metadata.status = "ready"
                metadata.artifact_files = copied_files
                metadata.flash_parts = flash_parts
                metadata.artifact_urls = {}
                metadata.error = ""
                self._persist(metadata)
        except Exception as exc:  # noqa: BLE001
            with self.lock:
                metadata = self.jobs[request.hash]
                metadata.status = "failed"
                metadata.error = str(exc)
                self._persist(metadata)
        finally:
            with self.lock:
                self.active_jobs.discard(request.hash)

    def _collect_artifacts(self, request: BuildRequest, work_project: Path) -> dict[str, Path]:
        output_dir = work_project / "build_output" / "bin"
        env_prefix = request.env
        artifacts: dict[str, Path] = {}

        for candidate in output_dir.glob(f"{env_prefix}*"):
            name = candidate.name
            if name.endswith(".bin.gz"):
                artifacts["gz"] = candidate
            elif name.endswith("-factory.bin"):
                artifacts["factory"] = candidate
            elif name.endswith(".bin"):
                artifacts["bin"] = candidate

        pio_dir = work_project / ".pio" / "build" / request.env
        if "bin" not in artifacts:
            firmware = pio_dir / "firmware.bin"
            if firmware.exists():
                artifacts["bin"] = firmware
        if "factory" not in artifacts:
            factory = pio_dir / "firmware-factory.bin"
            if factory.exists():
                artifacts["factory"] = factory
        for extra_name, key in (
            ("bootloader.bin", "bootloader"),
            ("partitions.bin", "partitions"),
            ("boot_app0.bin", "boot_app0"),
        ):
            extra_path = pio_dir / extra_name
            if extra_path.exists():
                artifacts[key] = extra_path

        return artifacts

    def _chip_family_for_env(self, env_name: str) -> str:
        if "ESP32C6" in env_name:
            return "ESP32-C6"
        if "ESP32C3" in env_name:
            return "ESP32-C3"
        if "ESP32" in env_name:
            return "ESP32"
        return "ESP8266"

    def _flash_manifest_parts(self, request: BuildRequest) -> list[tuple[str, str]]:
        pio_dir = self._work_project_dir(request.hash) / ".pio" / "build" / request.env
        env_dump = pio_dir / "firmware.env.txt"
        if not env_dump.exists():
            return []

        content = env_dump.read_text(encoding="utf-8", errors="replace")
        extra_images_match = re.search(r"'FLASH_EXTRA_IMAGES':\s*(\[[\s\S]*?\])", content)
        app_offset_match = re.search(r"'ESP32_APP_OFFSET':\s*'([^']+)'", content)
        if app_offset_match is None:
            app_offset_match = re.search(r"'application_offset':\s*'([^']+)'", content)

        parts: list[tuple[str, str]] = []
        if extra_images_match:
            try:
                extra_images = ast.literal_eval(extra_images_match.group(1))
            except (SyntaxError, ValueError):
                extra_images = []
            for offset, path in extra_images:
                name = Path(path).name
                if name in {"bootloader.bin", "partitions.bin", "boot_app0.bin"}:
                    parts.append((name, str(offset)))

        application_kind = "factory" if request.env.startswith("GUI_Generic_ESP32") else "bin"
        if app_offset_match:
            parts.append((application_kind, app_offset_match.group(1)))
        elif not parts:
            parts.append(("bin", "0x0"))

        return parts

    def _build_flash_parts(self, request: BuildRequest, artifact_files: dict[str, str]) -> list[dict[str, str]]:
        parts: list[dict[str, str]] = []
        has_application = False
        aliases = {
            "bootloader.bin": "bootloader",
            "partitions.bin": "partitions",
            "boot_app0.bin": "boot_app0",
        }
        for name, offset in self._flash_manifest_parts(request):
            filename = artifact_files.get(name) or artifact_files.get(aliases.get(name, ""))
            if name == "factory" and not filename:
                filename = artifact_files.get("bin")
            elif name == "bin" and not filename:
                filename = artifact_files.get("factory")
            if not filename:
                continue
            if name in {"bin", "factory"}:
                has_application = True
            parts.append({"offset": offset, "artifact": name, "path": filename})

        if parts and has_application:
            return parts

        fallback_kind = "factory" if "factory" in artifact_files and self._chip_family_for_env(request.env) != "ESP8266" else "bin"
        filename = artifact_files.get(fallback_kind)
        if not filename:
            return []
        return [{"offset": "0x0", "artifact": fallback_kind, "path": filename}]

    def _generate_platformio_ini(self, request: BuildRequest) -> str:
        original = (GUI_GENERIC_DIR / "platformio.ini").read_text(encoding="utf-8")
        build_flags = self._compose_build_flags(request)
        build_lines = ["build_flags ="] + [f"                {line}" for line in build_flags]
        patched = replace_multiline_option(original, "common", "build_flags", build_lines)

        extra_libs = self._compose_extra_libs(request)
        if extra_libs:
            lib_lines = ["lib_deps ="] + [f"    {line}" for line in extra_libs]
            patched = replace_multiline_option(patched, f"env:{request.env}", "lib_deps", lib_lines)

        return patched

    def _compose_extra_libs(self, request: BuildRequest) -> list[str]:
        libs: list[str] = []
        seen: set[str] = set()
        for option_id in request.selected_options:
            for lib in self.catalog.extra_libs_for_option(option_id):
                if lib not in seen:
                    libs.append(lib)
                    seen.add(lib)
        return libs

    def _compose_build_flags(self, request: BuildRequest) -> list[str]:
        flags = [
            "-D SUPLA_EXCLUDE_LITTLEFS_CONFIG",
            f"-D OPTIONS_HASH='\"{request.hash}\"'",
            f"-D BUILD_VERSION='\"{request.build_version}\"'",
        ]

        if request.public_builder_url:
            flags.append(f"-D HOST_BUILDER='\"{request.public_builder_url}\"'")

        if request.language and request.language != "pl":
            flags.append(f"-D UI_LANGUAGE={request.language}")

        if request.template_json:
            try:
                compact_template = json.dumps(json.loads(request.template_json), separators=(",", ":"))
            except json.JSONDecodeError:
                compact_template = " ".join(request.template_json.split())
            flags.append("-D TEMPLATE_BOARD_JSON")
            flags.append(f'-D TEMPLATE_JSON=\'R"json({compact_template})json"\'')

        for option_id in request.selected_options:
            flags.append(f"-D {option_id}")
            flags.extend(self.catalog.extra_flags_for_option(option_id))

        return flags


class BuilderHTTPHandler(BaseHTTPRequestHandler):
    server_version = "LocalSuplaBuilder/1.0"

    @property
    def app(self) -> "BuilderApplication":
        return self.server.app  # type: ignore[attr-defined]

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if "firmware" in query:
            self.handle_compatibility(parsed, query)
            return

        if parsed.path == "/api/config":
            payload = self.app.catalog.api_payload()
            payload["public_url"] = self.app.public_url
            json_response(self, HTTPStatus.OK, payload)
            return

        if parsed.path == "/api/builds":
            json_response(self, HTTPStatus.OK, {"items": self.app.manager.list_builds()})
            return

        if parsed.path == "/api/serial-ports":
            json_response(self, HTTPStatus.OK, {"items": list_serial_ports()})
            return

        if parsed.path.startswith("/api/builds/") and parsed.path.endswith("/manifest"):
            build_hash = parsed.path.strip("/").split("/")[2]
            metadata = self.app.manager.get(build_hash)
            if metadata is None:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nie znaleziono builda"})
                return
            self.app.manager.ensure_flash_parts(metadata)
            metadata = self.app.manager.get(build_hash)
            if metadata is None:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nie znaleziono builda"})
                return
            manifest = self.app.install_manifest(build_hash, metadata)
            if manifest is None:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Manifest instalacyjny jest niedostępny dla tego builda"})
                return
            json_response(self, HTTPStatus.OK, manifest)
            return

        if parsed.path.startswith("/api/builds/"):
            build_hash = parsed.path.rsplit("/", 1)[-1]
            metadata = self.app.manager.get(build_hash)
            if metadata is None:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nie znaleziono builda"})
                return
            payload = metadata.to_dict()
            payload["artifact_urls"] = self.app.artifact_urls(build_hash, metadata.artifact_files)
            payload["compatibility_url"] = self.app.compatibility_url(build_hash)
            if metadata.log_path and Path(metadata.log_path).exists():
                payload["log_tail"] = self.app.log_tail(Path(metadata.log_path))
            json_response(self, HTTPStatus.OK, payload)
            return

        if parsed.path.startswith("/artifacts/"):
            self.handle_artifact_download(parsed.path)
            return

        if parsed.path == "/files/GUI-GenericUploader.bin":
            self.serve_file(GUI_GENERIC_DIR / "tools" / "GUI-GenericUploader.bin")
            return

        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Niepoprawny JSON"})
            return

        if parsed.path != "/api/build":
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nieznany endpoint"})
            return

        request = BuildRequest.from_payload(payload)
        if request.template_name and not request.template_json:
            request.template_json = self.app.catalog.resolve_template_json(request.template_name)
        if not request.public_builder_url:
            request.public_builder_url = self.app.public_url
        request.hash = request.compute_hash()
        if request.env not in self.app.catalog.envs:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Nieznane środowisko kompilacji"})
            return

        metadata = self.app.manager.submit(request)
        response = metadata.to_dict()
        response["artifact_urls"] = self.app.artifact_urls(request.hash, metadata.artifact_files)
        response["compatibility_url"] = self.app.compatibility_url(request.hash)
        json_response(self, HTTPStatus.ACCEPTED, response)

    def handle_compatibility(self, parsed, query: dict[str, list[str]]) -> None:
        build_hash = query.get("firmware", [""])[0]
        if not build_hash:
            text_response(self, HTTPStatus.BAD_REQUEST, "UNKNOWN")
            return

        artifact_type = query.get("type", [""])[0]
        if artifact_type:
            artifact = self.app.manager.resolve_artifact(build_hash, artifact_type)
            if artifact is None:
                text_response(self, HTTPStatus.NOT_FOUND, "ERROR")
                return
            self.serve_file(artifact)
            return

        current_version = query.get("ver", [""])[0]
        text_response(self, HTTPStatus.OK, self.app.manager.compatibility_status(build_hash, current_version))

    def handle_artifact_download(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) != 3:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nieznany artefakt"})
            return
        _, build_hash, filename = parts
        artifact = BUILDS_DIR / build_hash / "artifacts" / filename
        if not artifact.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Brak pliku"})
            return
        self.serve_file(artifact)

    def serve_file(self, path: Path) -> None:
        if not path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", guess_mime(path))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        if path.suffix in {".bin", ".gz"}:
            self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
        self.end_headers()
        self.wfile.write(data)

    def serve_static(self, path: str) -> None:
        route = path if path not in {"", "/"} else "/index.html"
        file_path = STATIC_DIR / route.lstrip("/")
        if not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.serve_file(file_path)

    def log_message(self, fmt: str, *args: Any) -> None:
        return


class RedirectHTTPHandler(BaseHTTPRequestHandler):
    server_version = "LocalSuplaBuilderRedirect/1.0"

    @property
    def app(self) -> "BuilderApplication":
        return self.server.app  # type: ignore[attr-defined]

    def do_GET(self) -> None:  # noqa: N802
        self.redirect()

    def do_HEAD(self) -> None:  # noqa: N802
        self.redirect(send_body=False)

    def do_POST(self) -> None:  # noqa: N802
        self.redirect()

    def redirect(self, send_body: bool = True) -> None:
        location = self.app.redirect_target(self.path)
        body = f"Redirecting to {location}\n".encode("utf-8")
        self.send_response(HTTPStatus.MOVED_PERMANENTLY)
        self.send_header("Location", location)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        return


class BuilderApplication:
    def __init__(
        self,
        host: str,
        port: int,
        public_url: str,
        tls_cert: str = "",
        tls_key: str = "",
        http_redirect_port: int = 0,
    ) -> None:
        ensure_dirs()
        self.catalog = BuilderCatalog(GUI_GENERIC_DIR)
        self.manager = BuildManager(self.catalog)
        self.host = host
        self.port = port
        self.tls_cert = tls_cert.strip()
        self.tls_key = tls_key.strip()
        self.http_redirect_port = http_redirect_port
        default_scheme = "https" if self.tls_cert and self.tls_key else "http"
        self.public_url = normalize_public_url(public_url) or f"{default_scheme}://{host}:{port}/"

    def artifact_urls(self, build_hash: str, artifact_files: dict[str, str]) -> dict[str, str]:
        result: dict[str, str] = {}
        for kind in artifact_files:
            result[kind] = f"{self.compatibility_url(build_hash)}&type={kind}"
        return result

    def compatibility_url(self, build_hash: str) -> str:
        return f"{self.public_url}?firmware={build_hash}"

    def install_manifest_url(self, build_hash: str) -> str:
        return f"{self.public_url}api/builds/{build_hash}/manifest"

    def install_manifest(self, build_hash: str, metadata: BuildMetadata) -> dict[str, Any] | None:
        if metadata.status != "ready" or not metadata.flash_parts:
            return None

        parts = []
        for part in metadata.flash_parts:
            filename = part.get("path", "")
            if not filename:
                continue
            parts.append(
                {
                    "path": f"{self.compatibility_url(build_hash)}&type={part.get('artifact', '')}",
                    "offset": part.get("offset", "0x0"),
                }
            )

        if not parts:
            return None

        request = metadata.request or {}
        name = request.get("custom_name") or request.get("template_name") or build_hash
        version = request.get("build_version") or "dev"
        return {
            "name": f"SUPLA GUI Generic: {name}",
            "version": version,
            "home_assistant_domain": "supla",
            "builds": [
                {
                    "chipFamily": metadata.chip_family or "ESP8266",
                    "parts": parts,
                }
            ],
        }

    def log_tail(self, path: Path, lines: int = 80) -> str:
        content = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(content[-lines:])

    def redirect_target(self, path: str) -> str:
        clean_path = path or "/"
        if not clean_path.startswith("/"):
            clean_path = f"/{clean_path}"
        return f"{self.public_url.rstrip('/')}{clean_path}"

    def _serve_redirects(self) -> None:
        redirect_httpd = ThreadingHTTPServer((self.host, self.http_redirect_port), RedirectHTTPHandler)
        redirect_httpd.app = self  # type: ignore[attr-defined]
        redirect_httpd.serve_forever()

    def run(self) -> None:
        httpd = ThreadingHTTPServer((self.host, self.port), BuilderHTTPHandler)
        httpd.app = self  # type: ignore[attr-defined]
        if self.tls_cert or self.tls_key:
            if not self.tls_cert or not self.tls_key:
                raise ValueError("TLS wymaga podania zarówno certyfikatu, jak i klucza prywatnego.")
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(certfile=self.tls_cert, keyfile=self.tls_key)
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        if self.http_redirect_port > 0 and self.tls_cert and self.tls_key:
            redirect_thread = threading.Thread(target=self._serve_redirects, daemon=True)
            redirect_thread.start()
            print(f"http redirect listening on http://{self.host}:{self.http_redirect_port}/ -> {self.public_url}")
        print(f"supla-local-builder listening on {self.public_url}")
        httpd.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local GUI Generic firmware builder")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8181)
    parser.add_argument(
        "--public-url",
        default=os.environ.get("LOCAL_BUILDER_PUBLIC_URL", ""),
        help="Publiczny adres buildera używany do generowanych linków OTA",
    )
    parser.add_argument(
        "--tls-cert",
        default=os.environ.get("LOCAL_BUILDER_TLS_CERT", ""),
        help="Ścieżka do certyfikatu TLS PEM dla HTTPS",
    )
    parser.add_argument(
        "--tls-key",
        default=os.environ.get("LOCAL_BUILDER_TLS_KEY", ""),
        help="Ścieżka do klucza prywatnego TLS PEM dla HTTPS",
    )
    parser.add_argument(
        "--http-redirect-port",
        type=int,
        default=int(os.environ.get("LOCAL_BUILDER_HTTP_REDIRECT_PORT", "0") or "0"),
        help="Opcjonalny port HTTP zwracający przekierowanie 301 do HTTPS",
    )
    args = parser.parse_args()

    app = BuilderApplication(
        args.host,
        args.port,
        args.public_url,
        args.tls_cert,
        args.tls_key,
        args.http_redirect_port,
    )
    app.run()


if __name__ == "__main__":
    main()
