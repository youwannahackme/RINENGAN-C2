import uuid
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import hashlib

# Server-side encryption key for webhook URLs (never exposed)
from config import Config
_key = hashlib.sha256(Config.SECRET_KEY.encode('utf-8')).digest()
WEBHOOK_KEY = base64.urlsafe_b64encode(_key)
fernet = Fernet(WEBHOOK_KEY)

def encrypt_webhook_url(url):
    return fernet.encrypt(url.encode()).decode()

def decrypt_webhook_url(encrypted):
    return fernet.decrypt(encrypted.encode()).decode()

def generate_agent_secret():
    return hashlib.sha256(os.urandom(32)).hexdigest()[:64]

def encrypt_command_payload(payload, secret):
    # AES-GCM with 12-byte nonce
    nonce = os.urandom(12)
    cipher = AESGCM(secret.encode().ljust(32, b'\0')[:32])  # ensure exactly 32 bytes
    ciphertext = cipher.encrypt(nonce, json.dumps(payload).encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()

def decrypt_command_payload(encrypted_b64, secret):
    data = base64.b64decode(encrypted_b64)
    nonce = data[:12]
    ciphertext = data[12:]
    cipher = AESGCM(secret.encode().ljust(32, b'\0')[:32])
    decrypted = cipher.decrypt(nonce, ciphertext, None)
    return json.loads(decrypted.decode())

def generate_uuid():
    return str(uuid.uuid4())

def get_client_ip(request):
    return request.remote_addr

def is_ip_allowed(ip):
    from config import Config
    import ipaddress
    if not Config.IP_WHITELIST:
        return True
    if not ip or ip in ('127.0.0.1', '::1', 'localhost'):
        return True
    try:
        ip_obj = ipaddress.ip_address(ip)
    except Exception:
        return False
    for cidr in Config.IP_WHITELIST:
        try:
            net = ipaddress.ip_network(cidr)
            if ip_obj.version == net.version and ip_obj in net:
                return True
        except Exception:
            pass
    return False

def resolve_country(ip=None):
    import requests
    is_local = not ip or ip in ('127.0.0.1', '::1', 'localhost') or ip.startswith(('192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'))
    try:
        if is_local:
            r = requests.get('http://ip-api.com/json/?fields=status,countryCode', timeout=3)
            if r.status_code == 200 and r.json().get('status') == 'success':
                cc = r.json().get('countryCode')
                if cc: return cc
        else:
            r = requests.get(f'http://ip-api.com/json/{ip}?fields=status,countryCode', timeout=3)
            if r.status_code == 200 and r.json().get('status') == 'success':
                cc = r.json().get('countryCode')
                if cc: return cc
            r2 = requests.get('http://ip-api.com/json/?fields=status,countryCode', timeout=3)
            if r2.status_code == 200 and r2.json().get('status') == 'success':
                cc = r2.json().get('countryCode')
                if cc: return cc
    except Exception:
        pass

    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(10)
        if ctypes.windll.kernel32.GetUserDefaultGeoName(buf, 10) > 0 and buf.value:
            return buf.value
    except Exception:
        pass

    return 'PK'