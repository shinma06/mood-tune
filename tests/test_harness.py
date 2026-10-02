"""Exercise safety boundaries in temporary state, never the real desktop or GitHub."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import check
import git_guard
import gui_lease
import handoff_registry


class HarnessTest(unittest.TestCase):
    def test_push_guard(self):
        branch = 'agent/12-sample'
        sha, old, zero = 'a' * 40, 'b' * 40, '0' * 40
        good = f'refs/heads/{branch} {sha} refs/heads/{branch} {old}'
        self.assertTrue(git_guard.check_push([good], branch, sha, False))
        for line in [good.replace('refs/heads/' + branch, 'refs/heads/main'),
                     good.replace(sha, old),
                     good.replace('refs/heads/' + branch, 'refs/heads/agent/13-other')]:
            with self.assertRaises(ValueError):
                git_guard.check_push([line], branch, sha, False)
        with self.assertRaises(ValueError):
            git_guard.check_push([good], branch, sha, True)
        with self.assertRaises(ValueError):
            git_guard.check_push([f'(delete) {zero} refs/heads/develop {sha}'], branch, sha, False)

    def test_gui_lease_expiry_does_not_transfer_ownership(self):
        with tempfile.TemporaryDirectory() as tmp:
            with gui_lease.locked(Path(tmp)) as path:
                a = gui_lease.transition(path, 'acquire', owner='test', issue=1, run='r', head='a' * 40)
                a['expires_at'] = 0
                path.write_text(json.dumps(a))
                with self.assertRaises(ValueError):
                    gui_lease.transition(path, 'acquire', owner='other', issue=2, run='s', head='b' * 40)
                with self.assertRaises(ValueError):
                    gui_lease.transition(path, 'release', token='wrong')
                self.assertTrue(gui_lease.transition(path, 'status')['expired'])
                gui_lease.transition(path, 'release', token=a['token'])
                self.assertEqual(gui_lease.transition(path, 'status'), {'state': 'free'})

    def test_private_registry_tampering_and_wrong_host(self):
        with tempfile.TemporaryDirectory() as tmp:
            public = handoff_registry.register(tmp, {'owner': 'test', 'head': 'a' * 40}, '/example/work', 'test-host')
            self.assertNotIn('source', public)
            self.assertEqual(handoff_registry.resolve(tmp, public, 'test-host')['source'], '/example/work')
            for payload, host in [(dict(public, owner='other'), 'test-host'), (public, 'other-host')]:
                with self.assertRaises(ValueError):
                    handoff_registry.resolve(tmp, payload, host)
            path = Path(tmp) / 'registry' / (public['registry_id'] + '.json')
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                handoff_registry.resolve(tmp, public, 'test-host')

    def test_registry_rejects_symlink_and_unsafe_directory_without_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outside = root / 'outside'
            outside.mkdir(mode=0o755)
            outside.chmod(0o755)
            storage = root / 'storage'
            storage.mkdir(mode=0o700)
            registry = storage / 'registry'
            registry.symlink_to(outside, target_is_directory=True)
            with self.assertRaises((OSError, ValueError)):
                handoff_registry.register(storage, {'owner': 'test'}, '/example/work', 'host')
            with self.assertRaises(ValueError):
                handoff_registry.resolve(storage, {'version': 2, 'registry_id': 'a' * 32}, 'host')
            self.assertEqual(outside.stat().st_mode & 0o777, 0o755)
            self.assertEqual(list(outside.iterdir()), [])
            registry.unlink()
            registry.mkdir(mode=0o755)
            registry.chmod(0o755)
            with self.assertRaises(ValueError):
                handoff_registry.register(storage, {'owner': 'test'}, '/example/work', 'host')
            self.assertEqual(registry.stat().st_mode & 0o777, 0o755)
            self.assertEqual(list(registry.iterdir()), [])
            alias = root / 'alias'
            alias.symlink_to(storage, target_is_directory=True)
            with self.assertRaises((OSError, ValueError)):
                handoff_registry.register(alias, {'owner': 'test'}, '/example/work', 'host')

    def test_validator_does_not_echo_secrets_and_detects_bad_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q', tmp], check=True)
            secret = 'github' + '_pat_' + 'x' * 30
            (root / 'bad.md').write_text(secret + '\n[missing](absent.md)\n')
            subprocess.run(['git', '-C', tmp, 'add', 'bad.md'], check=True)
            errors = check.validate(root)
            self.assertEqual(len(errors), 2)
            self.assertNotIn(secret, '\n'.join(errors))

    def test_validator_includes_untracked_files_and_rejects_env_variants(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q', tmp], check=True)
            (root / 'new.md').write_text('[missing](absent.md)\n')
            (root / '.env.local').write_text('EXAMPLE=not-a-secret\n')
            errors = check.validate(root)
            self.assertEqual(len(errors), 2)
            self.assertTrue(any('private state' in error for error in errors))

    def test_bootstrap_preserves_custom_hooks(self):
        script = Path(__file__).resolve().parents[1] / 'scripts/bootstrap.py'
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
            env['GIT_CONFIG_GLOBAL'] = os.devnull
            env['GIT_CONFIG_NOSYSTEM'] = '1'
            subprocess.run(['git', 'init', '-q', tmp], check=True, env=env)
            (root / '.githooks').mkdir()
            for name in ['pre-commit', 'pre-push']:
                (root / '.githooks' / name).write_text('#!/bin/sh\nexit 0\n')
            subprocess.run(['git', 'config', 'core.hooksPath', 'custom-hooks'], cwd=tmp, env=env, check=True)
            attempt = subprocess.run([sys.executable, str(script)], cwd=tmp, env=env, capture_output=True)
            self.assertNotEqual(attempt.returncode, 0)
            self.assertEqual(subprocess.check_output(['git', 'config', 'core.hooksPath'], cwd=tmp, env=env).strip(), b'custom-hooks')
            subprocess.run(['git', 'config', '--unset', 'core.hooksPath'], cwd=tmp, env=env, check=True)
            old_hook = root / '.git/hooks/pre-commit'
            old_hook.write_text('#!/bin/sh\nexit 42\n')
            old_hook.chmod(0o755)
            attempt = subprocess.run([sys.executable, str(script)], cwd=tmp, env=env, capture_output=True)
            self.assertNotEqual(attempt.returncode, 0)
            self.assertEqual(subprocess.run(['git', 'hook', 'run', 'pre-commit'], cwd=tmp, env=env,
                                            capture_output=True).returncode, 42)
            self.assertEqual(subprocess.run(['git', 'config', '--get', 'core.hooksPath'], cwd=tmp, env=env,
                                            capture_output=True).returncode, 1)
            old_hook.unlink()
            subprocess.run([sys.executable, str(script)], cwd=tmp, env=env, check=True, capture_output=True)
            subprocess.run([sys.executable, str(script)], cwd=tmp, env=env, check=True, capture_output=True)


if __name__ == '__main__':
    unittest.main()
