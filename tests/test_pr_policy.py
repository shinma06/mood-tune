"""Policy fixtures never contact GitHub or trust a PR as executable code."""
import base64
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import pr_policy as policy


class PolicyTest(unittest.TestCase):
    def setUp(self):
        self.base = 'b' * 40
        self.pr = {'head': {'ref': 'codex/22-harness', 'sha': 'a' * 40}, 'base': {'ref': 'main'},
                   'body': 'Issue: #22\nIntegration: main\nVerification: docs/verification/changes/issue-22.json\nGUI: not-required\nGUI reason: Only workflow files change\nWriter: writer-session'}
        self.issue = {'number': 22, 'title': '[運用] ハーネス', 'state': 'open', 'body': 'Acceptance',
                      'labels': [{'name': x} for x in ('type:maintenance', 'priority:P1', 'status:review')]}
        self.acceptance = {'schema': 1, 'issue': 22, 'gui_required': False,
                           'reason': 'Only workflow files change', 'cli_checks': ['npm run check'], 'cases': []}
        self.record = {'head': 'a' * 40, 'base': self.base, 'input_digest': policy.input_digest(self.pr, self.issue, self.base),
                       'reviewer_session': 'independent-session', 'verdict': 'approved', 'unresolved_findings': [],
                       'evidence': 'Review report and disposition', 'cases': []}

    def test_policy_rejects_mismatched_metadata_and_duplicate_labels(self):
        policy.validate_policy(self.pr, self.issue)
        for old, new in [('Issue: #22', 'Issue: #23'), ('Integration: main', 'Integration: develop'),
                         ('GUI reason: Only workflow files change', 'GUI reason: TODO'),
                         ('Writer: writer-session', 'Writer: <owner>')]:
            pr = dict(self.pr, body=self.pr['body'].replace(old, new))
            with self.subTest(new=new), self.assertRaises(ValueError):
                policy.validate_policy(pr, self.issue)
        issue = copy.deepcopy(self.issue)
        issue['labels'].append({'name': 'status:done'})
        with self.assertRaises(ValueError):
            policy.validate_policy(self.pr, issue)

    def test_review_expires_when_inputs_change_and_cannot_be_self_approved(self):
        policy.validate_review(self.record, self.pr, self.issue, self.base)
        for record in [dict(self.record, head='c' * 40), dict(self.record, base='c' * 40),
                       dict(self.record, reviewer_session='writer-session'), dict(self.record, verdict='changes_requested'),
                       dict(self.record, unresolved_findings=['P1'])]:
            with self.subTest(record=record), self.assertRaises(ValueError):
                policy.validate_review(record, self.pr, self.issue, self.base)
        with self.assertRaises(ValueError):
            policy.validate_review(self.record, self.pr, dict(self.issue, body='New acceptance'), self.base)
        with self.assertRaises(ValueError):
            policy.validate_review(self.record, self.pr, dict(self.issue, state='closed'), self.base)

    def test_latest_authorized_review_wins_and_bad_record_does_not_fall_back(self):
        body = policy.MARKER + '\n```json\n' + json.dumps(self.record) + '\n```'
        good = {'id': 1, 'author_association': 'OWNER', 'body': body}
        outsider = {'id': 2, 'author_association': 'NONE', 'body': body}
        self.assertEqual(policy.review_record([good, outsider]), self.record)
        with self.assertRaises(ValueError):
            policy.review_record([good, {'id': 3, 'author_association': 'OWNER', 'body': policy.MARKER}])

    def test_ui_cannot_be_hidden_as_tooling_and_all_cases_need_current_evidence(self):
        self.assertEqual(policy.validate_acceptance(self.acceptance, self.pr, ['docs/project.md']), set())
        with self.assertRaises(ValueError):
            policy.validate_acceptance(self.acceptance, self.pr, ['src/app/page.tsx'])
        case = {'id': 'UI-1', 'preconditions': 'Non-login mode', 'steps': ['Open page'], 'expected': 'Playlist visible'}
        data = dict(self.acceptance, gui_required=True, cases=[case])
        pr = dict(self.pr, body=self.pr['body'].replace('GUI: not-required', 'GUI: required'))
        ids = policy.validate_acceptance(data, pr, ['src/app/page.tsx'])
        observation = {'id': 'UI-1', 'status': 'pass', 'head': 'a' * 40, 'observer': 'qa-session',
                       'build': 'preview of current SHA', 'evidence': 'Recorded browser observation'}
        policy.validate_observations({'cases': [observation]}, ids, 'a' * 40)
        for cases in [[], [observation, observation], [dict(observation, status='pending')],
                      [dict(observation, head='c' * 40)], [dict(observation, evidence='')]]:
            with self.subTest(cases=cases), self.assertRaises(ValueError):
                policy.validate_observations({'cases': cases}, ids, 'a' * 40)
        second = dict(observation, id='UI-2')
        policy.validate_observations({'cases': [observation, second]}, {'UI-1', 'UI-2'}, 'a' * 40)
        with self.assertRaises(ValueError):
            policy.validate_observations({'cases': [observation, dict(second, build='different build')]},
                                         {'UI-1', 'UI-2'}, 'a' * 40)

    def test_changed_invalid_metadata_invalidates_previous_success_before_failure(self):
        pr = dict(self.pr, state='open', body='Invalid edited PR body', html_url='https://example.test/pr/1')
        calls = []
        def api(path, payload=None):
            calls.append((path, payload))
            if path == 'pulls/1':
                return pr
            if path == 'git/ref/heads/main':
                return {'object': {'sha': self.base}}
            return {}
        with patch.object(policy, 'api', side_effect=api), self.assertRaises(ValueError):
            policy.run(1, publish=True)
        published = [payload for _, payload in calls if payload]
        self.assertEqual({p['context'] for p in published}, {'PR policy', 'Agent review', 'Acceptance gate'})
        self.assertTrue(all(p['state'] == 'pending' for p in published))

    def test_base_fetch_failure_invalidates_previous_success(self):
        pr = dict(self.pr, state='open', html_url='https://example.test/pr/1')
        published = []
        def api(path, payload=None):
            if payload is not None:
                published.append(payload)
                return {}
            if path == 'pulls/1':
                return pr
            raise OSError('GitHub temporarily unavailable')
        with patch.object(policy, 'api', side_effect=api), self.assertRaises(OSError):
            policy.run(1, publish=True)
        self.assertEqual({p['context'] for p in published}, {'PR policy', 'Agent review', 'Acceptance gate'})
        self.assertTrue(all(p['state'] == 'pending' for p in published))

    def test_issue_closure_during_check_cannot_publish_success(self):
        pr = dict(self.pr, state='open', html_url='https://example.test/pr/1')
        for closed in (False, True):
            published, reads = [], []
            def api(path, payload=None):
                if payload is not None:
                    published.append(payload)
                    return {}
                if path == 'pulls/1':
                    return pr
                if path == 'git/ref/heads/main':
                    return {'object': {'sha': self.base}}
                if path == 'issues/22':
                    reads.append(path)
                    return dict(self.issue, state='closed') if closed and len(reads) > 1 else self.issue
                if path.startswith('contents/'):
                    return {'content': base64.b64encode(json.dumps(self.acceptance).encode()).decode()}
                if path.startswith('issues/1/comments?'):
                    return [{'id': 1, 'author_association': 'OWNER',
                             'body': policy.MARKER + '\n```json\n' + json.dumps(self.record) + '\n```'}]
                if path.startswith('pulls/1/files?'):
                    return [{'filename': 'docs/project.md'}]
                raise AssertionError(path)
            with self.subTest(closed=closed), patch.object(policy, 'api', side_effect=api):
                if closed:
                    with self.assertRaises(ValueError):
                        policy.run(1, publish=True)
                    self.assertEqual([p['state'] for p in published], ['pending'] * 3)
                else:
                    self.assertTrue(policy.run(1, publish=True))
                    self.assertEqual([p['state'] for p in published], ['pending'] * 3 + ['success'] * 3)


if __name__ == '__main__':
    unittest.main()
