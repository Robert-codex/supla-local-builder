# Instalacja `supla-local-builder` na Debianie i pochodnych

Instrukcja działa dla systemów opartych na Debianie, np. Debian, Ubuntu, Linux Mint, Proxmox VE i Raspberry Pi OS.

## 1. Pakiety systemowe

Zainstaluj podstawowe zależności:

```bash
sudo apt update
sudo apt install -y git curl python3 python3-pip python3-venv build-essential
```

## 2. Klon repozytorium

Przez SSH:

```bash
git clone git@github.com:Robert-codex/supla-local-builder.git
cd supla-local-builder
```

Albo przez HTTPS:

```bash
git clone https://github.com/Robert-codex/supla-local-builder.git
cd supla-local-builder
```

## 3. Submodule i lokalne patche

```bash
git submodule update --init --recursive
./scripts/apply_gui_generic_patches.sh
```

Ten krok pobiera upstream `GUI-Generic` i nakłada lokalne zmiany projektu.

## 4. Lokalna instalacja PlatformIO

Builder może używać globalnego `platformio`, ale najprościej zainstalować lokalną kopię do repo:

```bash
./scripts/install_local_builder.sh
```

## 5. Ręczne uruchomienie buildera

```bash
./scripts/run_local_builder.sh
```

Domyślny adres:

```text
http://127.0.0.1:8181/
```

## 6. Dostęp z innych urządzeń LAN

Ustaw publiczny adres buildera:

```bash
export LOCAL_BUILDER_PUBLIC_URL="http://192.168.1.100:8181/"
./scripts/run_local_builder.sh
```

Podmień `192.168.1.100` na adres IP hosta.

## 7. Uruchomienie jako usługa `systemd`

Skopiuj jednostkę:

```bash
sudo cp scripts/local_builder.service /etc/systemd/system/local_builder.service
```

Zmień `LOCAL_BUILDER_PUBLIC_URL` w usłudze:

```bash
sudo nano /etc/systemd/system/local_builder.service
```

Przykład:

```text
Environment=LOCAL_BUILDER_PUBLIC_URL=http://192.168.1.100:8181/
```

Włącz usługę:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now local_builder.service
```

Status i logi:

```bash
sudo systemctl status local_builder.service
sudo journalctl -u local_builder.service -f
```

## 8. Aktualizacja projektu

Po aktualizacji repo odśwież też submodule i lokalne patche:

```bash
git pull
git submodule update --init --recursive
./scripts/apply_gui_generic_patches.sh
```

## 9. Sonoff Dual R3 Power Monitoring

Projekt rozróżnia:

- `Sonoff Dual R3 Lite`
- `Sonoff Dual R3 Power Monitoring`

Pomiar energii jest przewidziany dla `DUALR3 Power Monitoring`; `DUALR3 Lite` nie ma tego toru pomiarowego.

W builderze preset `Sonoff Dual R3 Power Monitoring` pozwala ręcznie wybrać układ pomiarowy montowany w tej serii:

- `BL0930`
- `CSE7761`
- `CSE7766`

Są też gotowe warianty:

- `Sonoff Dual R3 + BL0930`
- `Sonoff Dual R3 + CSE7761`
- `Sonoff Dual R3 + CSE7766`

Preset ustawia bazowy template płytki i dobiera odpowiednią opcję firmware bez ręcznego pisania `template JSON`.
