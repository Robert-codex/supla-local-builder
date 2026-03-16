import json
import tempfile
import unittest
from pathlib import Path

from local_builder.server import BuilderCatalog, incompatible_template_option_error


class BuilderCatalogTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.fixture_dir = Path(self.tmpdir.name)

    def tearDown(self) -> None:
        self.tmpdir.cleanup()

    def write_fixture(self, template_boards: list[dict[str, object]]) -> None:
        builder_json = {
            "version": "test",
            "SECTIONS": {
                "energy": {
                    "pl": "Energia",
                    "en": "Energy",
                }
            },
            "energy": {
                "SUPLA_HLW8012": {
                    "name": "HLW8012",
                    "defOn": False,
                    "opts": "-D SUPLA_HLW8012",
                },
                "SUPLA_CSE7766": {
                    "name": "CSE7766",
                    "defOn": False,
                    "opts": "-D SUPLA_CSE7766",
                },
                "SUPLA_BL0930": {
                    "name": "BL0930",
                    "defOn": False,
                    "opts": "-D SUPLA_BL0930",
                },
                "SUPLA_LED": {
                    "name": "LED",
                    "defOn": True,
                    "opts": "-D SUPLA_LED",
                },
            },
        }
        platformio_ini = "\n".join(
            [
                "[env:GUI_Generic_2MB]",
                "[env:GUI_Generic_ESP32]",
                "",
            ]
        )

        (self.fixture_dir / "builder.json").write_text(
            json.dumps(builder_json, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (self.fixture_dir / "template_boards.json").write_text(
            json.dumps(template_boards, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (self.fixture_dir / "platformio.ini").write_text(platformio_ini, encoding="utf-8")

    def test_local_option_aliases_are_injected_into_same_section(self) -> None:
        self.write_fixture(
            [
                {
                    "NAME": "Fixture Board",
                    "GPIO": [17, 0, 0],
                    "FLAG": 0,
                }
            ]
        )

        catalog = BuilderCatalog(self.fixture_dir)

        self.assertEqual(catalog.option_index["SUPLA_CSE7759"]["section"], "energy")
        self.assertEqual(catalog.option_index["SUPLA_CSE7759B"]["section"], "energy")
        self.assertEqual(catalog.option_index["SUPLA_CSE7759B_FG"]["section"], "energy")
        self.assertEqual(catalog.extra_flags_for_option("SUPLA_CSE7759"), ["-D SUPLA_HLW8012"])
        self.assertEqual(catalog.extra_flags_for_option("SUPLA_CSE7759B"), [])
        self.assertEqual(catalog.extra_flags_for_option("SUPLA_CSE7759B_FG"), [])
        self.assertIn("SUPLA_CSE7766", catalog.option_index["SUPLA_CSE7759B"]["depRel"])
        self.assertIn("SUPLA_CSE7759B_FG", catalog.option_index["SUPLA_CSE7759B"]["depRel"])
        self.assertIn("SUPLA_CSE7759B", catalog.option_index["SUPLA_CSE7759B_FG"]["depRel"])

    def test_local_pow_templates_are_available_with_sel_name(self) -> None:
        self.write_fixture(
            [
                {
                    "NAME": "Fixture Board",
                    "GPIO": [17, 0, 0],
                    "FLAG": 0,
                }
            ]
        )

        catalog = BuilderCatalog(self.fixture_dir)
        template_names = {template["NAME"] for template in catalog.template_boards}

        self.assertIn("Sonoff Pow R2 Power Monitoring", template_names)
        self.assertIn("Sonoff Pow R2 /SEL Power Monitoring (CSE7759 manual)", template_names)
        self.assertIn("Sonoff POW / POWR1 Power Monitoring (CSE7759)", template_names)
        self.assertIn("Sonoff POW Origin 16A Power Monitoring Switch Module (POWR316)", template_names)
        self.assertNotIn("Sonoff Pow R2 Power Monitoring (CSE7759 manual)", template_names)

        resolved = json.loads(
            catalog.resolve_template_json("Sonoff Pow R2 /SEL Power Monitoring (CSE7759 manual)")
        )
        self.assertEqual(resolved["NAME"], "Sonoff Pow R2 /SEL Power Monitoring (CSE7759 manual)")
        self.assertEqual(resolved["FLAG"], 0)

    def test_existing_upstream_template_name_is_not_duplicated(self) -> None:
        self.write_fixture(
            [
                {
                    "NAME": "Sonoff Pow R2 Power Monitoring",
                    "GPIO": [99, 0, 0],
                    "FLAG": 0,
                }
            ]
        )

        catalog = BuilderCatalog(self.fixture_dir)
        names = [template["NAME"] for template in catalog.template_boards]

        self.assertEqual(names.count("Sonoff Pow R2 Power Monitoring"), 1)

    def test_powr316_fg_is_blocked_when_template_exposes_only_uart_meter_pin(self) -> None:
        template_json = json.dumps(
            {
                "NAME": "Sonoff POW Origin 16A Power Monitoring Switch Module (POWR316)",
                "GPIO": [32, 0, 0, 0, 0, 576, 0, 0, 0, 224, 0, 0, 3104, 0, 320, 0],
                "FLAG": 0,
            },
            ensure_ascii=False,
        )

        error = incompatible_template_option_error(template_json, ["SUPLA_CSE7759B_FG"])

        self.assertIn("SUPLA_CSE7759B_FG", error)
        self.assertIn("NewCSE7766Rx=3104", error)

    def test_powr316_uart_variant_is_not_blocked(self) -> None:
        template_json = json.dumps(
            {
                "NAME": "Sonoff POW Origin 16A Power Monitoring Switch Module (POWR316)",
                "GPIO": [32, 0, 0, 0, 0, 576, 0, 0, 0, 224, 0, 0, 3104, 0, 320, 0],
                "FLAG": 0,
            },
            ensure_ascii=False,
        )

        error = incompatible_template_option_error(template_json, ["SUPLA_CSE7759B"])

        self.assertEqual(error, "")

    def test_powr316_fg_is_allowed_with_custom_template_cf_pin(self) -> None:
        template_json = json.dumps(
            {
                "NAME": "Sonoff POW Origin 16A Power Monitoring Switch Module (POWR316)",
                "GPIO": [32, 0, 0, 0, 0, 576, 0, 0, 0, 224, 0, 0, 2688, 0, 320, 0],
                "FLAG": 0,
            },
            ensure_ascii=False,
        )

        error = incompatible_template_option_error(template_json, ["SUPLA_CSE7759B_FG"])

        self.assertEqual(error, "")


if __name__ == "__main__":
    unittest.main()
