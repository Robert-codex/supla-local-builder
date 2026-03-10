# supla-local-builder

Initial repository setup.

## Structure

- `src/` application source code
- `tests/` automated tests
- `docs/` project documentation
- `scripts/` development and maintenance scripts
- `external/GUI-Generic/` upstream GUI Generic firmware source as a git submodule
- `local_builder/` local WWW builder for generating firmware from `builder.json`
- `patches/gui-generic/` local patch set applied on top of upstream `GUI-Generic`

## GUI-Generic Submodule

Przy świeżym klonie uruchom:

```bash
git submodule update --init --recursive
./scripts/apply_gui_generic_patches.sh
```

To pobiera upstream `GUI-Generic` i nakłada lokalne zmiany dla MQTT, Zigbee gateway i lokalnego buildera OTA.

## Local Builder

Lokalny builder uruchamia stronę WWW podobną do `gui-generic-builder.supla.io` i korzysta bezpośrednio z:

- `external/GUI-Generic/builder.json`
- `external/GUI-Generic/template_boards.json`
- `external/GUI-Generic/platformio.ini`

Uruchomienie:

```bash
scripts/run_local_builder.sh
```

Domyślny adres:

```text
http://127.0.0.1:8181/
```

Wymagania:

- `python3`
- `platformio` albo `pio` w `PATH`, albo lokalna instalacja przez skrypt poniżej

Instalacja lokalnego `PlatformIO` do repo bez `sudo`:

```bash
scripts/install_local_builder.sh
```

Jeżeli builder ma generować linki OTA dostępne z sieci lokalnej, ustaw:

```bash
export LOCAL_BUILDER_PUBLIC_URL="http://IP_TWOJEGO_HOSTA:8181/"
```

Uruchomienie jako usługa `systemd`:

```bash
sudo cp scripts/local_builder.service /etc/systemd/system/local_builder.service
sudo systemctl daemon-reload
sudo systemctl enable --now local_builder.service
```

Przed włączeniem usługi warto poprawić `LOCAL_BUILDER_PUBLIC_URL` w pliku `scripts/local_builder.service` na właściwy adres hosta w LAN.
