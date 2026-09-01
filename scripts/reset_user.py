#!/usr/bin/env python3
"""
reset_user.py - Reset User Credentials & 2FA
Updates or resets username, password, and clears 2FA (TOTP) without wiping database tables.
Usage:
    python reset_user.py [new_username] [new_password]
    Example: python reset_user.py admin admin123
"""

import sys
import sqlite3
import os
import bcrypt

def get_db_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    possible_paths = [
        os.path.join(project_root, 'instance', 'c2.db'),
        os.path.join(project_root, 'c2.db'),
        os.path.join(base_dir, 'instance', 'c2.db'),
        os.path.join(base_dir, 'c2.db'),
        os.path.join(os.getcwd(), 'instance', 'c2.db'),
        os.path.join(os.getcwd(), 'c2.db')
    ]
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return possible_paths[0]

def reset_user(new_username=None, new_password=None):
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"[-] Database file not found at {db_path}")
        print("    Run 'python app.py' first to initialize the database.")
        return False

    username = (new_username or 'admin').strip()
    password = new_password or 'admin123'

    if len(username) < 3:
        print("[-] Username must be at least 3 characters long.")
        return False

    if len(password) < 4:
        print("[-] Password must be at least 4 characters long.")
        return False

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Check if any user exists
    c.execute("SELECT id FROM user LIMIT 1;")
    user_row = c.fetchone()

    if user_row:
        user_id = user_row[0]
        c.execute("""
            UPDATE user 
            SET username = ?, 
                password_hash = ?, 
                totp_secret = NULL, 
                totp_setup_complete = 0, 
                active_session_token = NULL 
            WHERE id = ?
        """, (username, password_hash, user_id))
    else:
        c.execute("""
            INSERT INTO user (username, password_hash, totp_secret, totp_setup_complete, is_admin)
            VALUES (?, ?, NULL, 0, 1)
        """, (username, password_hash))

    conn.commit()
    conn.close()

    print("=" * 60)
    print("[+] User credentials reset successfully!")
    print(f"    • Username : {username}")
    print(f"    • Password : {password}")
    print(f"    • 2FA / TOTP: Cleared (Disabled)")
    print("=" * 60)
    return True

if __name__ == '__main__':
    user_arg = sys.argv[1] if len(sys.argv) > 1 else None
    pass_arg = sys.argv[2] if len(sys.argv) > 2 else None
    reset_user(user_arg, pass_arg)
