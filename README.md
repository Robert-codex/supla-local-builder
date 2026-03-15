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
```

To pobiera `GUI-Generic` dokładnie do commita śledzonego przez to repo, razem z lokalnymi zmianami dla MQTT, buildera OTA i dodatkowych presetów/liczników energii.

Skrypt `./scripts/apply_gui_generic_patches.sh` zostaje jako ścieżka awaryjna, gdy świadomie przełączysz submodule na czysty upstream `GUI-Generic` bez lokalnej gałęzi patchy.

Aktualny model utrzymania lokalnych zmian w submodule:

- `external/GUI-Generic` ma lokalną gałąź `local-builder-patches`
- główne repo śledzi commit tej gałęzi jako wskaźnik submodule

Bezpieczna aktualizacja submodule:

```bash
cd /home/langnet/Projekty/Supla
git fetch origin
git checkout main
git pull --ff-only

cd /home/langnet/Projekty/Supla/external/GUI-Generic
git fetch origin
git checkout local-builder-patches
git rebase origin/master

cd /home/langnet/Projekty/Supla
git add external/GUI-Generic
git commit -m "Update GUI-Generic submodule"
```

Jeżeli rebase zgłosi konflikt, sprawdź najpierw:

- `external/GUI-Generic/platformio.ini`
- `external/GUI-Generic/src/GUI-Generic.ino`
- `external/GUI-Generic/builder.json`

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

Aktualnie skonfigurowany wariant publiczny w tym środowisku działa przez Cloudflare Tunnel:

```text
https://builder.regnal.eu/
```

## Cloudflare Tunnel

Pliki użyte w aktualnej konfiguracji:

- [cloudflared-builder.yml](/home/langnet/Projekty/Supla/scripts/cloudflared-builder.yml)
- [cloudflared-builder-access.yml.example](/home/langnet/Projekty/Supla/scripts/cloudflared-builder-access.yml.example)
- [cloudflared-builder.service](/home/langnet/Projekty/Supla/scripts/cloudflared-builder.service)
- [local_builder.service](/home/langnet/Projekty/Supla/scripts/local_builder.service)

Lokalny builder działa jako origin tylko na `127.0.0.1:8181`, a publiczny ruch HTTPS obsługuje Cloudflare Tunnel pod `builder.regnal.eu`.

Jeżeli hostname ma być chroniony, nie zostawiaj samego tunelu bez Access. Gotowy wariant utwardzony z `Cloudflare Access`, lokalną walidacją JWT w `cloudflared` i HTTPS do originu jest opisany w [cloudflare-tunnel-hardening.md](/home/langnet/Projekty/Supla/docs/cloudflare-tunnel-hardening.md).

Podstawowe komendy utrzymaniowe:

```bash
sudo systemctl status local_builder.service
sudo systemctl status cloudflared-builder.service
sudo journalctl -u local_builder.service -f
sudo journalctl -u cloudflared-builder.service -f
cloudflared tunnel info supla-builder
```

## LAN / lokalny HTTPS

Alternatywnie możesz wystawić builder lokalnie w LAN z własnym certyfikatem:

```bash
./scripts/generate_local_tls_cert.sh localhost 192.168.1.100
export LOCAL_BUILDER_PUBLIC_URL="https://192.168.1.100:8181/"
export LOCAL_BUILDER_TLS_CERT="$PWD/local_builder/data/certs/local-builder.crt"
export LOCAL_BUILDER_TLS_KEY="$PWD/local_builder/data/certs/local-builder.key"
export LOCAL_BUILDER_HTTP_REDIRECT_PORT="80"
./scripts/run_local_builder.sh
```

Przekierowanie HTTP działa z osobnego portu, zwykle `80`, na adres HTTPS buildera. Nie da się zrobić przekierowania z `http://IP:8181/` do `https://IP:8181/`, bo port `8181` jest zajęty przez TLS.

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

Jeżeli chcesz używać Web Serial z Chrome po adresie LAN, wystaw builder po HTTPS:

```bash
./scripts/generate_local_tls_cert.sh localhost IP_TWOJEGO_HOSTA
export LOCAL_BUILDER_PUBLIC_URL="https://IP_TWOJEGO_HOSTA:8181/"
export LOCAL_BUILDER_TLS_CERT="$PWD/local_builder/data/certs/local-builder.crt"
export LOCAL_BUILDER_TLS_KEY="$PWD/local_builder/data/certs/local-builder.key"
./scripts/run_local_builder.sh
```

Uruchomienie jako usługa `systemd`:

```bash
sudo cp scripts/local_builder.service /etc/systemd/system/local_builder.service
sudo systemctl daemon-reload
sudo systemctl enable --now local_builder.service
```

Przed włączeniem usługi ustaw właściwy adres hosta w LAN i wygeneruj certyfikat dla tego hosta:

```bash
./scripts/generate_local_tls_cert.sh localhost IP_TWOJEGO_HOSTA
```

Następnie popraw `LOCAL_BUILDER_PUBLIC_URL`, `LOCAL_BUILDER_TLS_CERT` i `LOCAL_BUILDER_TLS_KEY` w pliku [local_builder.service](/home/langnet/Projekty/Supla/scripts/local_builder.service).

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

## Sonoff Pow / POWR Power Monitoring

Lokalny builder ma teraz też osobne presety dla rodziny `Sonoff Pow R2`, klasycznego `Sonoff POW / POWR1` i `Sonoff POWR316`.

Dostępne warianty w sekcji presetów sprzętowych:

- `Sonoff Pow R2 Power Monitoring`
- `Sonoff Pow R2 + CSE7766`
- `Sonoff Pow R2 + CSE7759B-S`
- `Sonoff Pow R2 /SEL + CSE7759 (manual)`
- `Sonoff Pow R2 + CSE7759 (verified PCB 1739DIE)`
- `Sonoff POW / POWR1 + CSE7759`
- `Sonoff POWR316`
- `Sonoff POWR316 + CSE7766`
- `Sonoff POWR316 + CSE7759B-S`

Zasady działania:

- `CSE7759B-S` jest wystawiony jako osobna opcja buildowa `SUPLA_CSE7759B`, ale firmware używa obecnie tej samej ścieżki UART co `CSE7766`.
- `CSE7759` jest wystawiony jako alias `SUPLA_CSE7759`, który mapuje się na istniejący driver `HLW8012` z pinami `CF/CF1/SEL`; kompilacja dostaje `SUPLA_CSE7759` (wybrana opcja) oraz `SUPLA_HLW8012` (alias do istniejącego drivera), więc UI pokazuje nazwę `CSE7759`.
- `Sonoff POW / POWR1 + CSE7759` jest traktowany jako stabilny preset dla starego wariantu impulsowego z mapą `SEL=GPIO5`, `CF1=GPIO13`, `CF=GPIO14`.
- `Sonoff Pow R2 /SEL + CSE7759 (manual)` generuje własny template z ręcznie wpisanymi pinami `CF/CF1/SEL` i zostaje jako wariant ogólny dla innych rewizji PCB.
- `Sonoff Pow R2 + CSE7759 (verified PCB 1739DIE)` używa zweryfikowanej mapy `SEL=GPIO5`, `CF1=GPIO13`, `CF=GPIO14`; w tym wariancie `CF1` współdzieli `GPIO13` z obwodem stockowego LED.

Po flashu kalibracja napięcia i energii dla tych wariantów jest dostępna w GUI urządzenia w `Ustawienia urządzenia -> Inne -> Calibration`.

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
./scripts/install_local_builder.sh

export LOCAL_BUILDER_PUBLIC_URL="http://IP_TWOJEGO_HOSTA:8181/"
./scripts/run_local_builder.sh
```

Po tym builder będzie dostępny z innych urządzeń w LAN pod adresem:

```text
http://IP_TWOJEGO_HOSTA:8181/
```
