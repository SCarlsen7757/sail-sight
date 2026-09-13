"""Create credentials for a disposable Compose regression stack; never prints secrets."""
from pathlib import Path
import secrets

path=Path('.security-compose.env')
if path.exists():
    raise SystemExit('Test environment file already exists; refusing to replace credentials.')
password=secrets.token_hex(24)
path.write_text(f'POSTGRES_PASSWORD={password}\nRUNTIME_DB_PASSWORD={secrets.token_hex(24)}\nAUTH_ADMIN_EMAIL=compose-admin@test.local\nAUTH_ADMIN_PASSWORD={password}\n')
path.chmod(0o600)
