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

## Sonoff Dual R3 Power Monitoring

`Sonoff Dual R3 Power Monitoring (DUALR3)` jest tu obsługiwany osobno od `Sonoff Dual R3 Lite`.

Zgodnie z oficjalnym opisem Sonoff, dwukanałowy pomiar energii dotyczy `DUALR3`, a nie `DUALR3 Lite`.

Lokalny builder ma preset sprzętowy dla `DUALR3 Power Monitoring`, który pozwala ręcznie dobrać układ pomiarowy występujący w tej serii:

- `BL0930`
- `CSE7761`
- `CSE7766`

Dostępne są też gotowe warianty:

- `Sonoff Dual R3 + BL0930`
- `Sonoff Dual R3 + CSE7761`
- `Sonoff Dual R3 + CSE7766`

Preset automatycznie ustawia bazowy template płytki, a warianty z licznikiem wypełniają też domyślne ustawienia układu pomiarowego.

## Debian Installation

Instrukcja instalacji na dowolnej maszynie z systemem opartym o Debiana jest w:

- [docs/install-debian.md](/home/langnet/Projekty/Supla/docs/install-debian.md)

Skrócona instalacja dla Debian/Ubuntu z dostępem w LAN:

```bash
sudo apt update
sudo apt install -y git curl python3 python3-pip python3-venv build-essential

git clone https://github.com/Robert-codex/supla-local-builder.git
cd supla-local-builder

git submodule update --init --recursive
./scripts/apply_gui_generic_patches.sh
./scripts/install_local_builder.sh

export LOCAL_BUILDER_PUBLIC_URL="http://IP_TWOJEGO_HOSTA:8181/"
./scripts/run_local_builder.sh
```

Po tym builder będzie dostępny z innych urządzeń w LAN pod adresem:

```text
http://IP_TWOJEGO_HOSTA:8181/
```
