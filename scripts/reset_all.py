#!/usr/bin/env python3
"""
reset_all.py - Full System Reset (Wipe Database & Users)
Wipes all database tables including users, restoring the system to a clean state.
When you run 'python app.py' after this script, accessing the panel will automatically show the Setup Page (/setup).
Usage:
    python reset_all.py
"""

import sqlite3
import os

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

def reset_everything():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"[-] Database file not found at {db_path}")
        return False

    print(f"[+] Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Get list of existing tables
    tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]

    # Clear ALL tables including user
    all_tables = ['user', 'agent', 'command', 'webhook', 'keylog']
    cleared_count = 0
    for table in all_tables:
        if table in tables:
            c.execute(f"DELETE FROM {table};")
            print(f"    [+] Cleared table: {table}")
            cleared_count += 1

    # Reset auto-increment sequences
    if 'sqlite_sequence' in tables:
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('user', 'agent', 'command', 'webhook', 'keylog');")

    conn.commit()

    print("[+] Reclaiming database space (VACUUM)...")
    c.execute("VACUUM;")
    conn.close()

    print("=" * 60)
    print("[+] FULL SYSTEM RESET COMPLETE!")
    print("    • All user accounts, 2FA credentials, agents, and logs have been wiped.")
    print("    • Running 'python app.py' will now automatically open the Setup Page (/setup).")
    print("=" * 60)
    return True

if __name__ == '__main__':
    reset_everything()
