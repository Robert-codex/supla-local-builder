# Hardening Cloudflare Tunnel for the local builder

Ten wariant zakłada obecny model z repo:

- publiczny hostname: `https://builder.regnal.eu/`
- origin buildera: `127.0.0.1:8181`
- tunel uruchamiany lokalnie przez `cloudflared`

Cel:

- odciąć publiczny dostęp anonimowy,
- wymusić Cloudflare Access przed builderem,
- dodać walidację JWT po stronie `cloudflared`,
- szyfrować także odcinek `cloudflared -> local builder`.

## 1. Access application

W Cloudflare Zero Trust utwórz aplikację:

- `Access controls -> Applications -> Add an application -> Self-hosted`
- hostname: `builder.regnal.eu`
- session duration: `24h` albo krócej
- jeśli używasz jednego IdP, włącz `Instant Auth`

Minimalna polityka:

- `Allow`
- emails albo grupa tylko dla administratorów buildera

Jeżeli masz automatyzację:

- dodaj osobną politykę `Service Auth`
- nie otwieraj aplikacji publicznie

Jeżeli chcesz, aby nieautoryzowane żądania maszynowe zwracały od razu `401`, włącz w aplikacji:

- `401 Response for Service Auth policies`

## 2. Pobierz AUD tag aplikacji

`cloudflared` potrzebuje `AUD` aplikacji Access do lokalnej walidacji JWT.

Najprościej pobrać go przez API Cloudflare:

```bash
curl -s \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/access/apps?domain=builder.regnal.eu" \
  | jq -r '.result[0].aud'
```

Token API musi mieć co najmniej uprawnienie `Access: Apps and Policies Read`.

## 3. Włącz HTTPS na originie buildera

Wygeneruj lokalny certyfikat dla hosta publicznego:

```bash
./scripts/generate_local_tls_cert.sh builder.regnal.eu 127.0.0.1
```

Następnie uzupełnij [local_builder.service](/home/langnet/Projekty/Supla/scripts/local_builder.service):

```ini
Environment=LOCAL_BUILDER_HOST=127.0.0.1
Environment=LOCAL_BUILDER_PORT=8181
Environment=LOCAL_BUILDER_PUBLIC_URL=https://builder.regnal.eu/
Environment=LOCAL_BUILDER_TLS_CERT=/home/langnet/Projekty/Supla/local_builder/data/certs/local-builder.crt
Environment=LOCAL_BUILDER_TLS_KEY=/home/langnet/Projekty/Supla/local_builder/data/certs/local-builder.key
```

Builder nadal słucha tylko lokalnie, ale `cloudflared` łączy się z nim już po HTTPS.

## 4. Włącz Protect with Access w `cloudflared`

Skopiuj przykład do pliku roboczego:

```bash
cp scripts/cloudflared-builder-access.yml.example scripts/cloudflared-builder.yml
```

Uzupełnij dwa pola:

- `teamName`: nazwa zespołu Zero Trust, np. `twoj-zespol`
- `audTag[0]`: wartość `AUD` pobrana w kroku 2

Docelowy plik używa:

- `service: https://127.0.0.1:8181`
- `originServerName: builder.regnal.eu`
- `caPool: /home/langnet/Projekty/Supla/local_builder/data/certs/local-builder-ca.crt`
- `access.required: true`

To daje dwie warstwy ochrony:

- Cloudflare Access blokuje wejście z Internetu
- `cloudflared` odrzuca żądania bez poprawnego JWT nawet przy błędnej trasie lub pominięciu warstwy Access

## 5. Restart usług

```bash
sudo systemctl daemon-reload
sudo systemctl restart local_builder.service
sudo systemctl restart cloudflared-builder.service
sudo systemctl status local_builder.service
sudo systemctl status cloudflared-builder.service
```

## 6. Weryfikacja

Bez logowania:

```bash
curl -I https://builder.regnal.eu/
```

Oczekiwany efekt:

- przekierowanie do logowania Access albo odpowiedź odmowy dostępu

Z service tokenem:

```bash
curl -s \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  https://builder.regnal.eu/api/config
```

Oczekiwany efekt:

- odpowiedź `200`
- poprawny JSON konfiguracji buildera

## 7. Sekrety i rotacja

Na serwerze z tunelem trzymaj tylko:

- `~/.cloudflared/<TUNNEL-UUID>.json`

Nie trzymaj tam `cert.pem`, jeśli serwer nie ma zarządzać tunelami. `cert.pem` daje uprawnienia kontowe do zarządzania tunelami, a plik `UUID.json` pozwala tylko uruchamiać konkretny tunnel.

Warto też:

- ograniczyć prawa pliku `UUID.json` do właściciela
- rotować service tokeny używane przez automatyzację
- ustawić alert o wygaśnięciu service tokenów
