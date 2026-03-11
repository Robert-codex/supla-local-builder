#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/local_builder/data/certs"
HOSTNAME_VALUE="${1:-${LOCAL_BUILDER_TLS_HOSTNAME:-localhost}}"
IP_VALUE="${2:-${LOCAL_BUILDER_TLS_IP:-127.0.0.1}}"
CA_CERT_PATH="${CERT_DIR}/local-builder-ca.crt"
CA_KEY_PATH="${CERT_DIR}/local-builder-ca.key"
CERT_PATH="${CERT_DIR}/local-builder.crt"
KEY_PATH="${CERT_DIR}/local-builder.key"
CSR_PATH="${CERT_DIR}/local-builder.csr"
CA_SERIAL_PATH="${CERT_DIR}/local-builder-ca.srl"
CA_CONFIG_PATH="${CERT_DIR}/local-builder-ca.cnf"
SERVER_CONFIG_PATH="${CERT_DIR}/local-builder-server.cnf"

mkdir -p "${CERT_DIR}"

if [[ ! -s "${CA_CERT_PATH}" || ! -s "${CA_KEY_PATH}" ]]; then
cat > "${CA_CONFIG_PATH}" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = supla-local-builder Root CA

[v3_ca]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF

openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 3650 \
  -keyout "${CA_KEY_PATH}" \
  -out "${CA_CERT_PATH}" \
  -config "${CA_CONFIG_PATH}"
else
  echo "Używam istniejącego root CA: ${CA_CERT_PATH}"
fi

cat > "${SERVER_CONFIG_PATH}" <<EOF
[req]
distinguished_name = dn
prompt = no

[dn]
CN = ${HOSTNAME_VALUE}

[v3_server]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @san
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer

[san]
DNS.1 = ${HOSTNAME_VALUE}
DNS.2 = localhost
IP.1 = ${IP_VALUE}
IP.2 = 127.0.0.1
EOF

openssl req -nodes -newkey rsa:2048 -sha256 \
  -keyout "${KEY_PATH}" \
  -out "${CSR_PATH}" \
  -config "${SERVER_CONFIG_PATH}"

openssl x509 -req -sha256 -days 825 \
  -in "${CSR_PATH}" \
  -CA "${CA_CERT_PATH}" \
  -CAkey "${CA_KEY_PATH}" \
  -CAcreateserial \
  -CAserial "${CA_SERIAL_PATH}" \
  -out "${CERT_PATH}" \
  -extfile "${SERVER_CONFIG_PATH}" \
  -extensions v3_server

rm -f "${CSR_PATH}" "${CA_SERIAL_PATH}" "${CA_CONFIG_PATH}" "${SERVER_CONFIG_PATH}"
chmod 600 "${CA_KEY_PATH}"
chmod 600 "${KEY_PATH}"

echo "Wygenerowano lokalny root CA i certyfikat TLS serwera:"
echo "  ca cert: ${CA_CERT_PATH}"
echo "  ca key:  ${CA_KEY_PATH}"
echo "  cert: ${CERT_PATH}"
echo "  key:  ${KEY_PATH}"
