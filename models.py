from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt
import json

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    totp_secret = db.Column(db.String(32), nullable=True)
    totp_setup_complete = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    active_session_token = db.Column(db.String(64), nullable=True)
    last_activity = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
        except Exception:
            return False

class Agent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.String(64), unique=True, nullable=False)
    hostname = db.Column(db.String(255))
    custom_name = db.Column(db.String(255), nullable=True)
    os = db.Column(db.String(64))
    os_version = db.Column(db.String(255))
    cpu = db.Column(db.String(255))
    gpu = db.Column(db.String(255))
    ram = db.Column(db.Integer)  # MB
    ip = db.Column(db.String(45))
    country = db.Column(db.String(2))
    tags = db.Column(db.String(255))  # comma-separated
    last_heartbeat = db.Column(db.DateTime)
    online = db.Column(db.Boolean, default=True)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    heartbeat_interval = db.Column(db.Integer, default=30)  # seconds
    jitter = db.Column(db.Integer, default=5)  # seconds
    secret_key = db.Column(db.String(64), nullable=False)  # used for AES-GCM

    def to_dict(self):
        display_name = self.custom_name if (self.custom_name and self.custom_name.strip()) else self.hostname
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'hostname': display_name,
            'raw_hostname': self.hostname,
            'custom_name': self.custom_name,
            'os': self.os,
            'os_version': self.os_version,
            'cpu': self.cpu,
            'gpu': self.gpu,
            'ram': self.ram,
            'ip': self.ip,
            'country': self.country,
            'tags': [t.strip() for t in self.tags.split(',') if t.strip()] if self.tags else [],
            'online': self.online,
            'last_heartbeat': self.last_heartbeat.isoformat() + 'Z' if self.last_heartbeat else None,
            'registered_at': self.registered_at.isoformat() + 'Z' if self.registered_at else None
        }

class Command(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('agent.id'), nullable=False)
    command = db.Column(db.Text, nullable=False)
    parameters = db.Column(db.Text)  # JSON
    status = db.Column(db.String(16), default='pending')  # pending, sent, completed, failed, timeout
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    result = db.Column(db.Text)  # JSON
    error = db.Column(db.Text)



class Webhook(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(512), nullable=False)
    description = db.Column(db.String(255))
    encrypted_url = db.Column(db.Text, nullable=False)  # encrypted with server key
    active = db.Column(db.Boolean, default=True)