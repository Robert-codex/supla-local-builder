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

## 3. Submodule

```bash
git submodule update --init --recursive
```

Ten krok pobiera `GUI-Generic` do commita śledzonego przez to repo, razem z lokalnymi zmianami projektu.

Skrypt `./scripts/apply_gui_generic_patches.sh` jest potrzebny tylko wtedy, gdy świadomie przełączysz submodule na czysty upstream i chcesz ręcznie dołożyć lokalny patch set.

Jeżeli aktualizujesz istniejącą instalację, używaj workflow opartego o lokalną gałąź submodule:

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

Przy konfliktach podczas `rebase` sprawdź najpierw:

- `external/GUI-Generic/platformio.ini`
- `external/GUI-Generic/src/GUI-Generic.ino`
- `external/GUI-Generic/builder.json`

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

Jeżeli chcesz używać Chrome Web Serial po adresie LAN, uruchom builder po HTTPS:

```bash
./scripts/generate_local_tls_cert.sh localhost 192.168.1.100
export LOCAL_BUILDER_PUBLIC_URL="https://192.168.1.100:8181/"
export LOCAL_BUILDER_TLS_CERT="$PWD/local_builder/data/certs/local-builder.crt"
export LOCAL_BUILDER_TLS_KEY="$PWD/local_builder/data/certs/local-builder.key"
export LOCAL_BUILDER_HTTP_REDIRECT_PORT="80"
./scripts/run_local_builder.sh
```

## 6. Cloudflare Tunnel

Wariant zalecany dla publicznego dostępu bez otwierania portów na routerze.

Założenia:

- masz domenę w Cloudflare,
- chcesz wystawić np. `builder.regnal.eu`,
- lokalny builder działa na `127.0.0.1:8181`.

Instalacja:

```bash
sudo apt install -y cloudflared
cloudflared tunnel login
cloudflared tunnel create supla-builder
cloudflared tunnel route dns supla-builder builder.regnal.eu
```

Przykładowy plik konfiguracyjny tunelu:

```yaml
tunnel: <UUID>
credentials-file: /home/USER/.cloudflared/<UUID>.json

ingress:
  - hostname: builder.regnal.eu
    service: http://127.0.0.1:8181
  - service: http_status:404
```

Ustaw też publiczny adres buildera:

```bash
export LOCAL_BUILDER_PUBLIC_URL="https://builder.regnal.eu/"
./scripts/run_local_builder.sh
```

Po stronie `systemd` możesz użyć osobnej usługi dla `cloudflared`, analogicznie do:

- [cloudflared-builder.service](/home/langnet/Projekty/Supla/scripts/cloudflared-builder.service)
- [cloudflared-builder.yml](/home/langnet/Projekty/Supla/scripts/cloudflared-builder.yml)

Jeżeli builder ma być wystawiony publicznie, zalecany wariant produkcyjny to:

- `Cloudflare Access` przed `builder.regnal.eu`
- `Protect with Access` w `cloudflared`
- HTTPS także na odcinku `cloudflared -> local builder`

Gotowy przykład konfiguracji i runbook wdrożenia są w:

- [cloudflared-builder-access.yml.example](/home/langnet/Projekty/Supla/scripts/cloudflared-builder-access.yml.example)
- [cloudflare-tunnel-hardening.md](/home/langnet/Projekty/Supla/docs/cloudflare-tunnel-hardening.md)

Status:

```bash
sudo systemctl status cloudflared-builder.service
cloudflared tunnel info supla-builder
```

## 7. Dostęp z innych urządzeń LAN

Jeżeli nie chcesz używać Cloudflare Tunnel, możesz wystawić builder bezpośrednio w LAN.

Ustaw publiczny adres buildera:

```bash
export LOCAL_BUILDER_PUBLIC_URL="http://192.168.1.100:8181/"
./scripts/run_local_builder.sh
```

Podmień `192.168.1.100` na adres IP hosta.

Wariant HTTPS:

```bash
./scripts/generate_local_tls_cert.sh localhost 192.168.1.100
export LOCAL_BUILDER_PUBLIC_URL="https://192.168.1.100:8181/"
export LOCAL_BUILDER_TLS_CERT="$PWD/local_builder/data/certs/local-builder.crt"
export LOCAL_BUILDER_TLS_KEY="$PWD/local_builder/data/certs/local-builder.key"
./scripts/run_local_builder.sh
```

## 8. Uruchomienie jako usługa `systemd`

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
Environment=LOCAL_BUILDER_PUBLIC_URL=https://192.168.1.100:8181/
Environment=LOCAL_BUILDER_TLS_CERT=/home/USER/supla-local-builder/local_builder/data/certs/local-builder.crt
Environment=LOCAL_BUILDER_TLS_KEY=/home/USER/supla-local-builder/local_builder/data/certs/local-builder.key
Environment=LOCAL_BUILDER_HTTP_REDIRECT_PORT=80
```

Przekierowanie HTTP działa z osobnego portu, zwykle `80`, na adres HTTPS buildera. `http://IP:8181/` nie przekieruje się do `https://IP:8181/`, bo port `8181` jest już serwerem TLS.

Przed uruchomieniem usługi wygeneruj certyfikat:

```bash
./scripts/generate_local_tls_cert.sh localhost 192.168.1.100
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

## 9. Aktualizacja projektu

Po aktualizacji repo odśwież też submodule:

```bash
git pull
git submodule update --init --recursive
```

Jeżeli pracujesz na czystym upstream `GUI-Generic`, możesz dodatkowo uruchomić:

```bash
./scripts/apply_gui_generic_patches.sh
```

## 10. Sonoff Dual R3 Power Monitoring

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
