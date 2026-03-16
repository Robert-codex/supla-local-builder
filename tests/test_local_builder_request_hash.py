import os
import unittest

import local_builder.server as builder_server
from local_builder.server import BuildRequest


class BuildRequestHashTest(unittest.TestCase):
    def setUp(self) -> None:
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

    def test_hash_changes_when_source_signature_changes(self) -> None:
        original_resolver = builder_server.resolve_source_signature
        try:
            builder_server.resolve_source_signature = lambda: "sig-a"
            first = BuildRequest.from_payload(dict(self.base_payload))

            builder_server.resolve_source_signature = lambda: "sig-b"
            second = BuildRequest.from_payload(dict(self.base_payload))
        finally:
            builder_server.resolve_source_signature = original_resolver

        self.assertEqual(first.source_signature, "sig-a")
        self.assertEqual(second.source_signature, "sig-b")
        self.assertNotEqual(first.hash, second.hash)

    def test_hash_changes_when_dirty_worktree_content_changes(self) -> None:
        original_git_output = builder_server._git_output
        original_git_bytes = builder_server._git_bytes
        root_diff = {"value": b"diff-a"}

        def fake_git_output(repo_dir, *args):  # type: ignore[no-untyped-def]
            if args == ("rev-parse", "HEAD"):
                if repo_dir == builder_server.ROOT_DIR:
                    return "root-head"
                if repo_dir == builder_server.GUI_GENERIC_DIR:
                    return "gui-head"
            return ""

        def fake_git_bytes(repo_dir, *args):  # type: ignore[no-untyped-def]
            if args[:4] == ("diff", "--no-ext-diff", "--binary", "HEAD"):
                if repo_dir == builder_server.ROOT_DIR:
                    return root_diff["value"]
                return b""
            if args[:4] == ("ls-files", "--others", "--exclude-standard", "-z"):
                return b""
            return b""

        try:
            builder_server._git_output = fake_git_output
            builder_server._git_bytes = fake_git_bytes
            first = BuildRequest.from_payload(dict(self.base_payload))

            root_diff["value"] = b"diff-b"
            second = BuildRequest.from_payload(dict(self.base_payload))
        finally:
            builder_server._git_output = original_git_output
            builder_server._git_bytes = original_git_bytes

        self.assertNotEqual(first.source_signature, second.source_signature)
        self.assertNotEqual(first.hash, second.hash)

    def test_source_signature_env_override_is_used(self) -> None:
        previous = os.environ.get("LOCAL_BUILDER_SOURCE_SIGNATURE")
        try:
            os.environ["LOCAL_BUILDER_SOURCE_SIGNATURE"] = "manual-salt"
            request = BuildRequest.from_payload(dict(self.base_payload))
        finally:
            if previous is None:
                os.environ.pop("LOCAL_BUILDER_SOURCE_SIGNATURE", None)
            else:
                os.environ["LOCAL_BUILDER_SOURCE_SIGNATURE"] = previous

        self.assertEqual(request.source_signature, "manual-salt")
        self.assertEqual(request.canonical_payload()["source_signature"], "manual-salt")

    def test_force_rebuild_flag_does_not_change_request_hash(self) -> None:
        payload = dict(self.base_payload)
        no_force = BuildRequest.from_payload(payload)

        payload["force_rebuild"] = True
        forced = BuildRequest.from_payload(payload)

        self.assertFalse(no_force.force_rebuild)
        self.assertTrue(forced.force_rebuild)
        self.assertEqual(no_force.hash, forced.hash)


if __name__ == "__main__":
    unittest.main()
