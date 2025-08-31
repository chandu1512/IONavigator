set -euo pipefail

ROOT="/Users/chandudarapaneni/Documents/IONavigator/ION_Web/backend"
SRC="$ROOT/src"
VENV="$ROOT/.venv"
PY="$VENV/bin/python"
PORT=5001

mkdir -p "$SRC"

if [ ! -x "$PY" ]; then
  /usr/bin/python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"
python -m ensurepip --upgrade || true
if ! "$PY" -m pip --version >/dev/null 2>&1; then
  curl -sS https://bootstrap.pypa.io/get-pip.py -o "$VENV/get-pip.py"
  "$PY" "$VENV/get-pip.py"
  rm -f "$VENV/get-pip.py"
fi

cat > "$SRC/requirements.txt" <<'REQ'
Flask==3.1.1
Flask-Cors==6.0.1
Flask-SocketIO==5.5.1
python-socketio==5.12.1
python-engineio==4.10.1
eventlet==0.36.1
REQ

"$PY" -m pip install --upgrade pip setuptools wheel
"$PY" -m pip install -r "$SRC/requirements.txt"

PID=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)
[ -n "$PID" ] && kill -9 "$PID" || true

exec "$PY" "$SRC/api.py"
