"""Public opaque handoffs resolve only through the enrolling repository's private registry."""
import hashlib
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import uuid


@contextmanager
def registry_directory(storage, create=False):
    """Open private directories without following links or changing existing modes."""
    storage = Path(storage)
    if create:
        storage.mkdir(mode=0o700, parents=True, exist_ok=True)
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    parent = os.open(storage, flags)
    try:
        info = os.fstat(parent)
        if info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('Storage must be private and locally owned')
        if create:
            try:
                os.mkdir('registry', mode=0o700, dir_fd=parent)
            except FileExistsError:
                pass
        directory = os.open('registry', flags, dir_fd=parent)
        try:
            info = os.fstat(directory)
            if info.st_uid != os.getuid() or info.st_mode & 0o077:
                raise ValueError('Registry directory must be private and locally owned')
            yield directory
        finally:
            os.close(directory)
    finally:
        os.close(parent)


def digest(public):
    return hashlib.sha256(json.dumps(public, sort_keys=True).encode()).hexdigest()


def register(storage, public, source, host):
    public = dict(public, registry_id=uuid.uuid4().hex, version=2)
    with registry_directory(storage, create=True) as directory:
        fd = os.open(public['registry_id'] + '.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=directory)
        with os.fdopen(fd, 'w') as stream:
            json.dump({'digest': digest(public), 'source': str(source), 'host': host}, stream)
    return public


def resolve(storage, public, host):
    if public.get('version') != 2 or not re.fullmatch(r'[0-9a-f]{32}', public.get('registry_id', '')):
        raise ValueError('Invalid opaque enrollment')
    try:
        with registry_directory(storage) as directory:
            fd = os.open(public['registry_id'] + '.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
            with os.fdopen(fd) as stream:
                stat = os.fstat(stream.fileno())
                if stat.st_uid != os.getuid() or stat.st_mode & 0o077:
                    raise ValueError('Registry must be private and locally owned')
                local = json.load(stream)
    except (OSError, ValueError) as error:
        raise ValueError('Local enrollment registry unavailable or invalid; explicit owner recovery required') from error
    if (not isinstance(local, dict) or local.get('digest') != digest(public) or local.get('host') != host or
            not isinstance(local.get('source'), str) or not Path(local['source']).is_absolute()):
        raise ValueError('Enrollment binding/local ownership mismatch; preserve existing owner')
    return dict(public, source=local['source'], host=local['host'])
