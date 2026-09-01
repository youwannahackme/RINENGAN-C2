#!/usr/bin/env python3
"""
reset_db.py - Reset Database Telemetry Data Only
Clears agent logs, commands, webhooks, and keylog tables while preserving user credentials & 2FA.
Usage:
    python reset_db.py
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

def reset_db_only():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"[-] Database file not found at {db_path}")
        return False

    print(f"[+] Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Get list of existing tables
    tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]

    # Clear agent, command, webhook, keylog tables (do NOT delete 'user')
    data_tables = ['agent', 'command', 'webhook', 'keylog']
    cleared_count = 0
    for table in data_tables:
        if table in tables:
            c.execute(f"DELETE FROM {table};")
            print(f"    [+] Cleared table: {table}")
            cleared_count += 1

    # Reset auto-increment sequences for cleared data tables
    if 'sqlite_sequence' in tables:
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('agent', 'command', 'webhook', 'keylog');")

    conn.commit()

    print("[+] Reclaiming database space (VACUUM)...")
    c.execute("VACUUM;")
    conn.close()

    print("=" * 60)
    print(f"[+] Database telemetry data reset completed successfully ({cleared_count} tables cleared).")
    print("    • User accounts, passwords, and 2FA settings were PRESERVED.")
    print("=" * 60)
    return True

if __name__ == '__main__':
    reset_db_only()
