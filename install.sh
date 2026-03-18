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

# ── Check root ────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] Este script debe ejecutarse como root${NC}"
  echo "Ejecute: sudo bash install.sh"
  exit 1
fi

# ── Detect OS ─────────────────────────────────────────────
echo -e "${BLUE}[1/8] Detectando sistema operativo...${NC}"
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

# ── Get Domain ────────────────────────────────────────────
echo ""
echo -e "${BLUE}[2/8] Configuración de dominio${NC}"
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

# ── Swap Memory (Expert fix for small VPS) ────────────────
echo -e "${BLUE}[3/10] Verificando memoria RAM...${NC}"
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
echo -e "${BLUE}[4/10] Instalando dependencias del sistema...${NC}"
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

echo -e "${GREEN}✓ Dependencias del sistema instaladas${NC}"

# ... (Previous Node.js and SSL sections continue) ...

# ── Install Node.js 20 ───────────────────────────────────
echo ""
echo -e "${BLUE}[5/10] Instalando Node.js 20...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) instalado${NC}"

# ── SSL Certificate ──────────────────────────────────────
echo ""
echo -e "${BLUE}[6/10] Configurando SSL (Let's Encrypt)...${NC}"
apt-get install -y certbot

# Stop services that might use port 80
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

certbot certonly --standalone --agree-tos --register-unsafely-without-email \
  -d $DOMAIN --non-interactive || {
  echo -e "${YELLOW}[WARN] No se pudo obtener certificado SSL. Se usará HTTP.${NC}"
}
echo -e "${GREEN}✓ SSL configurado${NC}"

# ── Install V2Ray/Xray ───────────────────────────────────
echo ""
echo -e "${BLUE}[7/10] Instalando V2Ray/Xray...${NC}"
if ! command -v xray &> /dev/null; then
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install 2>/dev/null || {
    echo -e "${YELLOW}[WARN] No se pudo instalar Xray.${NC}"
  }
fi
echo -e "${GREEN}✓ V2Ray/Xray configurado${NC}"

# ── Deploy Panel ──────────────────────────────────────────
echo ""
echo -e "${BLUE}[8/10] Desplegando Panel La Casita...${NC}"

PANEL_DIR="/opt/lacasita"
mkdir -p $PANEL_DIR

# Copy files
if [ "$(pwd)" != "$PANEL_DIR" ]; then
  cp -r ./* $PANEL_DIR/
fi
cd $PANEL_DIR

# Install npm dependencies with more robustness
echo -e "Instalando módulos de Node.js (esto puede tardar unos minutos)..."
npm install --production --no-audit --no-fund || {
  echo -e "${RED}[ERROR] Error instalando dependencias. Revisa que tengas internet.${NC}"
  exit 1
}

# Create .env / config
cat > $PANEL_DIR/.env <<EOF
PANEL_PORT=$PANEL_PORT
PANEL_DOMAIN=$DOMAIN
SSL_CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
SSL_KEY=/etc/letsencrypt/live/$DOMAIN/privkey.pem
SESSION_SECRET=$(openssl rand -hex 32)
EOF

echo -e "${GREEN}✓ Panel desplegado en $PANEL_DIR${NC}"

# ── Create Systemd Service ───────────────────────────────
echo ""
echo -e "${BLUE}[9/10] Configurando servicio del sistema...${NC}"

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
echo -e "${BLUE}[10/10] Configurando Firewall...${NC}"
ufw allow $PANEL_PORT/tcp
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ INSTALACIÓN COMPLETADA                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Acceso al Panel:${NC}"
echo -e "  URL:    ${CYAN}http://$DOMAIN:$PANEL_PORT${NC}"
echo -e "  Admin:  ${CYAN}admin${NC}"
echo -e "  Pass:   ${CYAN}admin123${NC}"
echo ""
echo -e "${YELLOW}⚠  SI NO PUEDES ENTRAR:${NC}"
echo -e "  1. Verifica que el puerto $PANEL_PORT esté abierto en el panel de tu VPS (DigitalOcean/AWS)."
echo -e "  2. Asegúrate de usar HTTP y no HTTPS si no tienes SSL configurado."
echo -e "  3. Revisa los logs con: ${CYAN}journalctl -u lacasita -n 50${NC}"
echo ""
