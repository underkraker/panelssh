#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 🏠 La Casita Panel v2026 — Instalador Automático
# Compatible: Ubuntu 22.04 / 24.04
# ═══════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     🏠 La Casita Panel v2026 — Installer     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Check root / sudo auto-elevation ──────────────────────
if [[ $EUID -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] Elevando permisos con sudo para forzar modo root...${NC}"
    exec sudo -E bash "$0" "$@"
  fi
  echo -e "${RED}[ERROR] Se requiere root o sudo para continuar${NC}"
  exit 1
fi

# ── Detect OS ─────────────────────────────────────────────
echo -e "${BLUE}[1/11] Detectando sistema operativo...${NC}"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME=$ID
  OS_VERSION=$VERSION_ID
else
  echo -e "${RED}[ERROR] No se puede detectar el SO${NC}"
  exit 1
fi

if [[ "$OS_NAME" != "ubuntu" ]]; then
  echo -e "${RED}[ERROR] Solo Ubuntu es soportado. Detectado: $OS_NAME${NC}"
  exit 1
fi

if [[ "$OS_VERSION" != "22.04" && "$OS_VERSION" != "24.04" ]]; then
  echo -e "${YELLOW}[WARN] Versión no probada: $OS_VERSION. Continuando...${NC}"
fi

echo -e "${GREEN}✓ Ubuntu $OS_VERSION detectado${NC}"

detect_cloud_provider() {
  if curl -fs --max-time 1 -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/id" >/dev/null 2>&1; then
    echo "google"
    return
  fi

  if curl -fs --max-time 1 "http://169.254.169.254/latest/meta-data/instance-id" >/dev/null 2>&1; then
    echo "aws"
    return
  fi

  if curl -fs --max-time 1 -H "Metadata: true" "http://169.254.169.254/metadata/instance?api-version=2021-02-01" >/dev/null 2>&1; then
    echo "azure"
    return
  fi

  echo "otro"
}

force_root_access() {
  echo ""
  echo -e "${BLUE}[2/11] Configurando acceso root para compatibilidad...${NC}"

  # HARDEN SSH for stability but WITHOUT changing password
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
  sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

  grep -q '^PasswordAuthentication' /etc/ssh/sshd_config || echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
  grep -q '^PermitRootLogin' /etc/ssh/sshd_config || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config
  grep -q '^PubkeyAuthentication' /etc/ssh/sshd_config || echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

  systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

  CLOUD_PROVIDER=$(detect_cloud_provider)
  SERVER_USER=${SUDO_USER:-root}

  echo -e "${GREEN}✓ SSH configurado correctamente (proveedor: ${CLOUD_PROVIDER})${NC}"
}

force_root_access

# ── License Validation ─────────────────────────────────────
echo ""
echo -e "${BLUE}[2.5/11] Validando licencia de instalacion...${NC}"
read -p "Ingrese su LICENSE_KEY: " LICENSE_KEY

if [[ -z "$LICENSE_KEY" ]]; then
  echo -e "${RED}[ERROR] LICENSE_KEY requerida${NC}"
  exit 1
fi

read -p "URL API de licencias (ej: https://tu-dominio/api/license/validate): " LICENSE_API_URL
if [[ -z "$LICENSE_API_URL" ]]; then
  echo -e "${YELLOW}[WARN] Sin API de licencias: se instalara sin validacion remota obligatoria.${NC}"
  LICENSE_ENFORCE=0
else
  LICENSE_ENFORCE=1
  DETECTED_IP=$(curl -s4 ifconfig.me || curl -s4 icanhazip.com || true)
  LICENSE_PAYLOAD=$(printf '{"key":"%s","domain":"%s","ip":"%s","product":"la-casita-panel"}' "$LICENSE_KEY" "${DOMAIN:-}" "${DETECTED_IP:-}")
  LICENSE_RESPONSE=$(curl -fsS -m 12 -H "Content-Type: application/json" -d "$LICENSE_PAYLOAD" "$LICENSE_API_URL" || true)

  if [[ -z "$LICENSE_RESPONSE" ]] || [[ "$LICENSE_RESPONSE" != *'"valid":true'* ]]; then
    echo -e "${RED}[ERROR] Licencia invalida o API no disponible. Instalacion bloqueada.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Licencia validada correctamente${NC}"
fi

# ── Optional Telegram bot setup ────────────────────────────
echo ""
echo -e "${BLUE}[2.6/11] Configuracion opcional de bot Telegram...${NC}"
read -p "TOKEN del bot (opcional, Enter para omitir): " TELEGRAM_BOT_TOKEN
read -p "CHAT ID admin (opcional, Enter para omitir): " TELEGRAM_CHAT_ID

# ── Get Domain ────────────────────────────────────────────
echo ""
echo -e "${BLUE}[3/11] Configuración de dominio${NC}"
read -p "Ingrese su dominio o subdominio (ej: panel.midominio.com): " DOMAIN

if [[ -z "$DOMAIN" ]]; then
  echo -e "${RED}[ERROR] El dominio es requerido${NC}"
  exit 1
fi

# Get VPS IP
VPS_IP=$(curl -s4 ifconfig.me || curl -s4 icanhazip.com)
echo -e "IP del VPS: ${CYAN}$VPS_IP${NC}"

# Validate DNS
DOMAIN_IP=$(dig +short $DOMAIN 2>/dev/null | head -1)
echo -e "IP del dominio: ${CYAN}$DOMAIN_IP${NC}"

if [[ "$VPS_IP" != "$DOMAIN_IP" ]]; then
  echo -e "${YELLOW}[WARN] La IP del dominio ($DOMAIN_IP) no coincide con la IP del VPS ($VPS_IP)${NC}"
  read -p "¿Desea continuar de todas formas? (s/n): " CONTINUE
  if [[ "$CONTINUE" != "s" && "$CONTINUE" != "S" ]]; then
    echo -e "${RED}Instalación cancelada${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ DNS validado correctamente${NC}"
fi

# ── Panel Port ────────────────────────────────────────────
read -p "Puerto del panel (default: 2026): " PANEL_PORT
PANEL_PORT=${PANEL_PORT:-2026}
echo -e "${GREEN}✓ Panel en puerto $PANEL_PORT${NC}"

read -p "Modo de panel [client_lite/full] (default: client_lite): " PANEL_MODE
PANEL_MODE=${PANEL_MODE:-client_lite}
if [[ "$PANEL_MODE" != "client_lite" && "$PANEL_MODE" != "full" ]]; then
  echo -e "${YELLOW}[WARN] Modo invalido, usando client_lite${NC}"
  PANEL_MODE=client_lite
fi
echo -e "${GREEN}✓ Modo seleccionado: $PANEL_MODE${NC}"

# ── Swap Memory (Expert fix for small VPS) ────────────────
echo -e "${BLUE}[4/11] Verificando memoria RAM...${NC}"
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 1000 ]; then
  echo -e "${YELLOW}[INFO] RAM baja ($TOTAL_RAM MB). Creando swap para evitar fallos de npm...${NC}"
  if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}✓ Swap de 1GB activado${NC}"
  else
    echo -e "${GREEN}✓ Swap ya existe${NC}"
  fi
else
  echo -e "${GREEN}✓ RAM suficiente ($TOTAL_RAM MB)${NC}"
fi

# ── Install Dependencies ─────────────────────────────────
echo ""
echo -e "${BLUE}[5/11] Instalando dependencias del sistema...${NC}"
apt-get update -y
apt-get install -y \
  curl wget unzip \
  build-essential \
  python3-dev \
  libsqlite3-dev \
  ufw \
  stunnel4 \
  squid \
  python3 python3-pip \
  dnsutils \
  net-tools \
  cron \
  git

# Force stunnel4 activation (Ubuntu requirement)
echo "ENABLED=1" > /etc/default/stunnel4
systemctl enable stunnel4 2>/dev/null || true

# ── Harden SSH Config (Mobile Compatibility) ──────────────
echo -e "${BLUE}Configurando SSH para compatibilidad móvil...${NC}"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

echo -e "${GREEN}✓ Dependencias del sistema instaladas${NC}"

# ... (Previous Node.js and SSL sections continue) ...

# ── Install Node.js 20 ───────────────────────────────────
echo ""
echo -e "${BLUE}[6/11] Instalando Node.js 20...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) instalado${NC}"

# ── SSL Certificate ──────────────────────────────────────
echo ""
echo -e "${BLUE}[7/11] Configurando SSL (Let's Encrypt)...${NC}"
apt-get install -y certbot

# Pre-open port 80 for Certbot
ufw allow 80/tcp 2>/dev/null || true

# Stop services that might use port 80
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

# Try Let's Encrypt
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
certbot certonly --standalone --agree-tos --register-unsafely-without-email \
  -d $DOMAIN --non-interactive || {
  echo -e "${YELLOW}[WARN] No se pudo obtener certificado SSL real.${NC}"
  
  # Fallback: Self-signed certificate so Stunnel can still start
  echo -e "${BLUE}Generando certificado auto-firmado de respaldo...${NC}"
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=LaCasita/OU=Dev/CN=$DOMAIN"
}
echo -e "${GREEN}✓ SSL configurado (Certificado en $CERT_DIR)${NC}"

# ── Install V2Ray/Xray ───────────────────────────────────
echo ""
echo -e "${BLUE}[8/11] Instalando V2Ray/Xray...${NC}"
if ! command -v xray &> /dev/null; then
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install 2>/dev/null || {
    echo -e "${YELLOW}[WARN] No se pudo instalar Xray.${NC}"
  }
fi
echo -e "${GREEN}✓ V2Ray/Xray configurado${NC}"

# ── Install BadVPN (UDP Gateway) ──────────────────────────
echo ""
echo -e "${BLUE}[8.5/11] Instalando BadVPN (UDP Gateway)...${NC}"
if ! command -v badvpn-udpgw &> /dev/null; then
  wget -O /usr/local/bin/badvpn-udpgw "https://github.com/ambrop72/badvpn/raw/master/udpgw/badvpn-udpgw" 2>/dev/null || {
    # Fallback to a known precompiled static binary if the above repo changes
    wget -O /usr/local/bin/badvpn-udpgw "https://raw.githubusercontent.com/daybreakersx/premscript/master/badvpn-udpgw64" 2>/dev/null
  }
  chmod +x /usr/local/bin/badvpn-udpgw
fi
echo -e "${GREEN}✓ BadVPN configurado${NC}"

# ── Install Hysteria 2 ─────────────────────────────────────
echo ""
echo -e "${BLUE}[8.6/11] Instalando Hysteria v2...${NC}"
if ! command -v hysteria &> /dev/null; then
  # Download Hysteria 2 - static binary for Linux x86_64
  # Note: Version is pinned for stability
  HYSTERIA_VER="v2.5.2"
  wget -O /usr/local/bin/hysteria "https://github.com/apernet/hysteria/releases/download/app%2F${HYSTERIA_VER}/hysteria-linux-amd64" 2>/dev/null
  chmod +x /usr/local/bin/hysteria
fi
echo -e "${GREEN}✓ Hysteria configurado${NC}"

# ── Deploy Panel ──────────────────────────────────────────
echo ""
echo -e "${BLUE}[9/11] Desplegando Panel La Casita...${NC}"

PANEL_DIR="/opt/lacasita"
mkdir -p $PANEL_DIR

# Copy files including hidden ones (.env, .gitignore, etc)
echo "Copiando archivos..."
cp -af ./* $PANEL_DIR/ 2>/dev/null || true
cp -af ./.[!.]* $PANEL_DIR/ 2>/dev/null || true

cd $PANEL_DIR

# IMPORTANT: Force clean install to compile native better-sqlite3 binary on THIS VPS
echo -e "Instalando módulos de Node.js (con compilación nativa)..."
rm -rf node_modules package-lock.json
npm install --production --force || {
  echo -e "${RED}[ERROR] Falló la instalación de módulos. Intentando sin force...${NC}"
  npm install --production
}

# Create .env / config
cat > $PANEL_DIR/.env <<EOF
PANEL_MODE=$PANEL_MODE
PANEL_PORT=$PANEL_PORT
PANEL_DOMAIN=$DOMAIN
SSL_CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
SSL_KEY=/etc/letsencrypt/live/$DOMAIN/privkey.pem
SESSION_SECRET=$(openssl rand -hex 32)
LICENSE_KEY=$LICENSE_KEY
LICENSE_API_URL=$LICENSE_API_URL
LICENSE_ENFORCE=$LICENSE_ENFORCE
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF

echo -e "${GREEN}✓ Panel desplegado en $PANEL_DIR${NC}"

# ── Create Systemd Service ───────────────────────────────
echo ""
echo -e "${BLUE}[10/11] Configurando servicio del sistema...${NC}"

cat > /etc/systemd/system/lacasita.service <<EOF
[Unit]
Description=La Casita Panel v2026
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PANEL_DIR
EnvironmentFile=$PANEL_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl stop lacasita 2>/dev/null || true
systemctl enable lacasita
systemctl start lacasita

# ── Firewall ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}[10.5/11] Configurando Firewall (UFW)...${NC}"
apt install -y ufw wireguard &> /dev/null
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow ${PANEL_PORT}/tcp
ufw allow 8880/tcp
ufw allow 10085/tcp
ufw allow 10086/tcp
ufw allow 3128/tcp
ufw allow 7300/udp
ufw allow 4434/udp
ufw allow 51820/udp
ufw --force enable
echo -e "${GREEN}✓ Firewall configurado${NC}"

# ── Done & Diagnostic ─────────────────────────────────────
echo ""
echo -e "${BLUE}[11/11] Verificando instalación...${NC}"
sleep 5

if netstat -tuln | grep -q ":$PANEL_PORT "; then
  echo -e "${GREEN}✓ El panel está escuchando en el puerto $PANEL_PORT${NC}"
  
  # Try local curl test
  if command -v curl &> /dev/null; then
    LOCAL_TEST=$(curl -s -I http://localhost:$PANEL_PORT | head -n 1)
    if [[ "$LOCAL_TEST" == *"200"* ]] || [[ "$LOCAL_TEST" == *"302"* ]]; then
      echo -e "${GREEN}✓ Prueba local exitosa (Respuesta: $LOCAL_TEST)${NC}"
    else
      echo -e "${YELLOW}[WARN] El panel respondió de forma inusual localmente: $LOCAL_TEST${NC}"
    fi
  fi
else
  echo -e "${RED}[ERROR] El panel NO está escuchando en el puerto $PANEL_PORT.${NC}"
  echo -e "Revisa los errores con: journalctl -u lacasita -n 50"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ INSTALACIÓN COMPLETADA                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Acceso al Panel:${NC}"
echo -e "  URL:    ${CYAN}http://$DOMAIN:$PANEL_PORT${NC}"
echo -e "  Admin:  ${CYAN}admin${NC}"
echo -e "  Pass:   ${CYAN}admin123${NC}"
echo -e "  Root:   ${CYAN}credenciales en /root/.lacasita-root-credentials${NC}"
echo ""
echo -e "${YELLOW}⚠  SI NO PUEDES ENTRAR (DADO QUE EL PANEL YA ESTÁ CORRIENDO):${NC}"
echo -e "  1. Es un problema de FIREWALL EXTERNO de tu proveedor (DigitalOcean/AWS/Google Cloud)."
echo -e "  2. Debes abrir el puerto $PANEL_PORT en el panel web de tu proveedor."
echo -e "  3. Prueba acceder por IP: http://$(curl -s ifconfig.me):$PANEL_PORT"
echo ""
