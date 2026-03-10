#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
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

ROOT_DIR = Path(__file__).resolve().parent.parent
GUI_GENERIC_DIR = ROOT_DIR / "external" / "GUI-Generic"
STATIC_DIR = Path(__file__).resolve().parent / "static"
DATA_DIR = Path(__file__).resolve().parent / "data"
BUILDS_DIR = DATA_DIR / "builds"
WORK_DIR = DATA_DIR / "work"


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
        self.template_boards = load_json(gui_generic_dir / "template_boards.json")
        self.section_labels = self.builder_data.get("SECTIONS", {})
        self.section_keys = [key for key in self.builder_data.keys() if key not in ("version", "Opis struktury", "SECTIONS")]
        self.option_index = self._index_options()
        self.envs = parse_env_names(gui_generic_dir / "platformio.ini")

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
                log_path=payload.get("log_path", ""),
                error=payload.get("error", ""),
                platformio_cmd=payload.get("platformio_cmd", ""),
            )
            self.jobs[metadata.hash] = metadata

    def _persist(self, metadata: BuildMetadata) -> None:
        metadata.updated_at = time.time()
        save_json(self._metadata_path(metadata.hash), metadata.to_dict())

    def list_builds(self) -> list[dict[str, Any]]:
        with self.lock:
            ordered = sorted(self.jobs.values(), key=lambda item: item.updated_at, reverse=True)
            return [item.to_dict() for item in ordered[:25]]

    def get(self, build_hash: str) -> BuildMetadata | None:
        with self.lock:
            return self.jobs.get(build_hash)

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
        filename = metadata.artifact_files.get(requested_type)
        if not filename:
            return None
        path = self._artifacts_dir(build_hash) / filename
        return path if path.exists() else None

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
            for kind, source in artifacts.items():
                target = artifact_dir / source.name
                shutil.copy2(source, target)
                copied_files[kind] = target.name

            with self.lock:
                metadata = self.jobs[request.hash]
                metadata.status = "ready"
                metadata.artifact_files = copied_files
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

        return artifacts

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
            escaped_template = compact_template.replace("\\", "\\\\").replace('"', '\\"')
            flags.append("-D TEMPLATE_BOARD_JSON")
            flags.append(f'-D TEMPLATE_JSON="\\"{escaped_template}\\""')

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

        if parsed.path.startswith("/api/builds/"):
            build_hash = parsed.path.rsplit("/", 1)[-1]
            metadata = self.app.manager.get(build_hash)
            if metadata is None:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nie znaleziono builda"})
                return
            payload = metadata.to_dict()
            payload["artifact_urls"] = self.app.artifact_urls(build_hash, metadata.artifact_files)
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
        if parsed.path != "/api/build":
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Nieznany endpoint"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Niepoprawny JSON"})
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


class BuilderApplication:
    def __init__(self, host: str, port: int, public_url: str) -> None:
        ensure_dirs()
        self.catalog = BuilderCatalog(GUI_GENERIC_DIR)
        self.manager = BuildManager(self.catalog)
        self.host = host
        self.port = port
        self.public_url = normalize_public_url(public_url) or f"http://{host}:{port}/"

    def artifact_urls(self, build_hash: str, artifact_files: dict[str, str]) -> dict[str, str]:
        result: dict[str, str] = {}
        for kind, filename in artifact_files.items():
            result[kind] = f"{self.public_url}artifacts/{build_hash}/{filename}"
        return result

    def compatibility_url(self, build_hash: str) -> str:
        return f"{self.public_url}?firmware={build_hash}"

    def log_tail(self, path: Path, lines: int = 80) -> str:
        content = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(content[-lines:])

    def run(self) -> None:
        httpd = ThreadingHTTPServer((self.host, self.port), BuilderHTTPHandler)
        httpd.app = self  # type: ignore[attr-defined]
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
    args = parser.parse_args()

    app = BuilderApplication(args.host, args.port, args.public_url)
    app.run()


if __name__ == "__main__":
    main()
