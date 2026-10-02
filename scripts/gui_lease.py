#!/usr/bin/env python3
"""Cooperative host/user GUI lease. Expiration never transfers ownership."""
import argparse
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import re
import socket
import sys
import time
import uuid


@contextmanager
def locked(directory):
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = directory.lstat()
    if directory.is_symlink() or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('State directory must be private (0700), owned by this user, and not a symlink')
    fd = os.open(directory / 'mutex', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a') as gate:
        fcntl.flock(gate, fcntl.LOCK_EX)
        yield directory / 'lease.json'


def transition(path, action, *, token=None, owner=None, issue=None, run=None, head=None, minutes=45):
    now = time.time()
    if not 1 <= minutes <= 45:
        raise ValueError('minutes must be 1..45; renewal does not authorize a larger loop budget')
    exists = path.exists()
    current = json.loads(path.read_text()) if exists else None
    if exists and (not isinstance(current, dict) or
                   not {'token', 'expires_at', 'owner'} <= current.keys() or
                   not isinstance(current['token'], str) or not current['token'] or
                   not isinstance(current['expires_at'], (int, float))):
        raise ValueError('Corrupt lease; stop GUI and arrange manual recovery')
    if action == 'status':
        return dict(current, expired=now >= current['expires_at']) if current else {'state': 'free'}
    if action == 'acquire':
        if current:
            raise ValueError('GUI is occupied, even if expired: ' + json.dumps(current))
        if not owner or not run or not issue or issue < 1 or not re.fullmatch(r'[0-9a-f]{40}', head or ''):
            raise ValueError('owner, positive issue, run, and full source SHA are required')
        current = dict(token=str(uuid.uuid4()), owner=owner, issue=issue, run=run, head=head,
                       host=socket.gethostname(), uid=os.getuid(), acquired_at=now, expires_at=now + minutes * 60)
    else:
        if not current or token != current['token']:
            raise ValueError('Token mismatch or no active lease; no changes made')
        if action == 'release':
            path.unlink()
            return {'state': 'free', 'released_token': token}
        if action != 'renew':
            raise ValueError('Unknown action')
        current['expires_at'] = now + minutes * 60
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(current, indent=2) + '\n')
    os.replace(temporary, path)
    return current


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir', type=Path, default=Path('/tmp') / f'agent-harness-gui-{os.getuid()}')
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('status')
    acquire = sub.add_parser('acquire')
    for name in ('owner', 'run', 'head'):
        acquire.add_argument('--' + name, required=True)
    acquire.add_argument('--issue', type=int, required=True)
    acquire.add_argument('--minutes', type=int, default=45)
    renew = sub.add_parser('renew')
    renew.add_argument('--token', required=True)
    renew.add_argument('--minutes', type=int, default=15)
    sub.add_parser('release').add_argument('--token', required=True)
    args = vars(parser.parse_args())
    directory = args.pop('state_dir')
    try:
        with locked(directory) as path:
            result = transition(path, **args)
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
