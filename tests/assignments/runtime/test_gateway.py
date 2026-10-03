"""In-process gateway controls: fake sockets/upstreams, no Docker or live services."""
import email.message
import importlib.util
import io
import os
from pathlib import Path
import threading
import unittest
from unittest import mock
import uuid

spec = importlib.util.spec_from_file_location('ci_gateway_under_test', Path(__file__).with_name('gateway.py'))
gateway = importlib.util.module_from_spec(spec)
with mock.patch.dict(os.environ, {
    'CI_STACK_ID': 'staffing-ci-0123456789', 'CI_ANON_KEY': 'unit-anon',
    'CI_SERVICE_KEY': 'unit-service', 'CI_CONTROL_TOKEN': 'unit-control-secret-' * 3,
}):
    spec.loader.exec_module(gateway)


def response(raw, method='GET'):
    socket = mock.Mock()
    socket.makefile.return_value = io.BytesIO(raw)
    result = gateway.CertifiedResponse(socket, method=method)
    result.begin()
    return result


def framed(status=200, body=b'ok', headers=b''):
    return b'HTTP/1.1 ' + str(status).encode() + b' Unit\r\nContent-Length: ' + str(len(body)).encode() + b'\r\n' + headers + b'\r\n' + body


class GatewayTests(unittest.TestCase):
    def setUp(self):
        with gateway.lock:
            gateway.active = gateway.generation = 0
            gateway.uncertainty = 0
        self.child = {'x-ci-child': gateway.control_token}
        self.service = {'apikey': gateway.service_key, 'authorization': 'Bearer ' + gateway.service_key}

    def handler(self, path='/functions/v1/staffing-orchestrator', method='GET', headers=None, body=b''):
        handler = object.__new__(gateway.Handler)
        handler.path, handler.command = path, method
        handler.headers = email.message.Message()
        pairs = headers.items() if isinstance(headers, dict) else headers or []
        for key, value in pairs:
            handler.headers[key] = value
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        handler.statuses, handler.returned, handler.reply_states = [], [], []
        handler.send_response = lambda status: (handler.statuses.append(status), handler.reply_states.append(gateway.state()))
        handler.send_header = lambda key, value: handler.returned.append((key.lower(), value))
        handler.end_headers = lambda: None
        return handler

    def send(self, handler=None, raw=None, failure=None, observe=None):
        handler = handler or self.handler()
        upstream = mock.Mock()
        def getresponse():
            if observe:
                observe(handler, upstream)
            if failure:
                raise failure
            return response(raw if raw is not None else framed(), handler.command)
        upstream.getresponse.side_effect = getresponse
        with mock.patch.object(gateway.http.client, 'HTTPConnection', return_value=upstream) as connection:
            handler.run()
        if upstream.request.called:
            self.assertIs(upstream.response_class, gateway.CertifiedResponse)
        return handler, upstream, connection

    def fields(self, handler):
        return dict(handler.returned)

    def assert_terminal(self, uncertain=False, generation=2):
        snapshot = gateway.state()
        self.assertEqual(snapshot['active'], 0)
        self.assertEqual(snapshot['generation'], generation)
        self.assertEqual(snapshot['uncertainty'], int(uncertain))
        self.assertIs(type(snapshot['uncertainty']), int)

    def test_admission_before_body_and_active_through_downstream_flush(self):
        handler = self.handler(method='POST', headers={'Content-Length': '2'}, body=b'{}')
        def body_read(size):
            self.assertEqual(gateway.state()['active'], 1)
            self.assertEqual(gateway.state()['generation'], 1)
            return b'{}'
        handler.rfile = mock.Mock(read=body_read)
        output = mock.Mock()
        output.write.side_effect = lambda body: self.assertEqual(gateway.state()['active'], 1)
        output.flush.side_effect = lambda: self.assertEqual(gateway.state()['generation'], 1)
        handler.wfile = output
        self.send(handler, observe=lambda *_: self.assertEqual(gateway.state()['active'], 1))
        output.flush.assert_called_once()
        self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
        self.assert_terminal()

    def test_fully_received_error_statuses_are_complete_not_uncertain(self):
        for status in (200, 400, 500, 503):
            with self.subTest(status=status):
                handler, _, _ = self.send(raw=framed(status, b'application result', b'x-ci-upstream-complete: forged\r\nx-ci-transport-uncertain: 1\r\n'))
                self.assertEqual(handler.statuses, [status])
                self.assertEqual(handler.wfile.getvalue(), b'application result')
                self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
                self.assertNotIn('x-ci-transport-uncertain', self.fields(handler))
        self.assert_terminal(generation=8)

    def test_valid_chunked_terminator_and_trailers_certify_receipt(self):
        raw = b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n0\r\nX-Trailer: value\r\n\r\n'
        handler, _, _ = self.send(raw=raw)
        self.assertEqual(handler.wfile.getvalue(), b'ok')
        self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
        self.assert_terminal()

    def test_head_and_no_body_statuses_need_no_body_or_length(self):
        for method, status, headers in [('HEAD', 200, b'Content-Length: 50000000\r\n'), ('GET', 204, b''),
                                       ('GET', 205, b''), ('GET', 304, b'Content-Length: 123\r\n')]:
            with self.subTest(method=method, status=status):
                handler, _, _ = self.send(self.handler(method=method), b'HTTP/1.1 ' + str(status).encode() + b' Unit\r\n' + headers + b'\r\n')
                self.assertEqual(handler.statuses, [status])
                self.assertEqual(handler.wfile.getvalue(), b'')
                self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
        self.assert_terminal(generation=8)

    def test_truncation_invalid_and_unframed_responses_latch_uncertainty(self):
        raws = [
            b'HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\nshort',
            b'HTTP/1.1 200 OK\r\n\r\nclose-delimited',
            b'HTTP/1.1 200 OK\r\nContent-Length: invalid\r\n\r\n',
            b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\nok',
            b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\n\r\nbody',
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nshort',
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n',
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n0\r\n',
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nokXX0\r\n\r\n',
            b'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n',
        ]
        for raw in raws:
            with self.subTest(raw=raw):
                self.setUp()
                handler, _, _ = self.send(raw=raw)
                self.assertEqual(handler.statuses, [502])
                self.assertEqual(self.fields(handler)['x-ci-transport-uncertain'], '1')
                self.assertNotIn('x-ci-upstream-complete', self.fields(handler))
                self.assertEqual(handler.reply_states[0]['uncertainty'], 1)
                self.assertEqual(handler.reply_states[0]['active'], 1)
                self.assert_terminal(uncertain=True)

    def test_declared_and_chunked_overflow_latch_uncertainty(self):
        for raw in [framed(body=b'large'), b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nlarge\r\n0\r\n\r\n']:
            with self.subTest(raw=raw), mock.patch.object(gateway, 'response_limit', 4):
                self.setUp()
                handler, _, _ = self.send(raw=raw)
                self.assertEqual(handler.statuses, [502])
                self.assert_terminal(uncertain=True)

    def test_timeout_disconnect_and_failure_before_receipt_are_sticky(self):
        for error in [TimeoutError(), ConnectionResetError(), gateway.http.client.RemoteDisconnected()]:
            with self.subTest(error=type(error).__name__):
                self.setUp()
                handler, _, connection = self.send(failure=error)
                self.assertEqual(connection.call_args.kwargs['timeout'], 40)
                self.assertEqual(handler.statuses, [502])
                self.assert_terminal(uncertain=True)
                self.send()
                self.assert_terminal(uncertain=True, generation=4)

    def test_downstream_disconnect_after_receipt_preserves_certainty(self):
        handler = self.handler()
        handler.wfile = mock.Mock()
        handler.wfile.write.side_effect = BrokenPipeError()
        self.send(handler)
        self.assertEqual(handler.statuses, [200])
        self.assert_terminal()

    def test_bad_request_framing_and_body_read_failure_are_admitted_first(self):
        cases = [({'Content-Length': '50'}, b'short', 400), ({'Content-Length': '1048577'}, b'', 413),
                 ([('Content-Length', '0'), ('Content-Length', '0')], b'', 400),
                 ({'Transfer-Encoding': 'chunked'}, b'', 400), ({'Content-Length': 'no'}, b'', 400)]
        for headers, body, status in cases:
            with self.subTest(headers=headers):
                self.setUp()
                handler, upstream, _ = self.send(self.handler(method='POST', headers=headers, body=body))
                self.assertEqual(handler.statuses, [status])
                upstream.request.assert_not_called()
                self.assert_terminal(uncertain=True)
        self.setUp()
        handler = self.handler(method='POST', headers={'Content-Length': '2'})
        handler.rfile = mock.Mock(read=mock.Mock(side_effect=TimeoutError()))
        self.send(handler)
        self.assertEqual(handler.statuses, [502])
        self.assert_terminal(uncertain=True)

    def test_state_requires_exact_secret_or_service_credentials_and_never_counts(self):
        for headers in [self.child, self.service]:
            handler, _, connection = self.send(self.handler('/_ci-gateway-state', headers=headers))
            connection.assert_not_called()
            result = gateway.json.loads(handler.wfile.getvalue())
            self.assertEqual(set(result), {'protocol', 'boot', 'generation', 'active', 'uncertainty'})
            self.assertEqual(result['protocol'], 1)
            self.assertEqual(str(uuid.UUID(result['boot'])), gateway.boot)
            self.assertEqual(result, gateway.state())
        for headers in [{}, {'apikey': gateway.service_key}, {'authorization': 'Bearer ' + gateway.service_key},
                        {'x-ci-child': 'wrong'}, {'x-ci-child': gateway.control_token + 'x'},
                        [('x-ci-child', gateway.control_token), ('x-ci-child', gateway.control_token)]]:
            handler, _, connection = self.send(self.handler('/_ci-gateway-state', headers=headers))
            self.assertEqual(handler.statuses, [401])
            connection.assert_not_called()
        handler, _, _ = self.send(self.handler('/_ci-gateway-state', method='POST', headers=self.child))
        self.assertEqual(handler.statuses, [405])
        self.assert_terminal(generation=0)

    def test_exact_authenticated_runtime_and_capture_controls_do_not_count(self):
        for path, method in [('/functions/v1/_local-drain', 'POST'), ('/functions/v1/_local-release', 'POST'),
                             ('/functions/v1/_local-bootstrap', 'POST'), ('/functions/v1/_local-health', 'GET'),
                             ('/_ci-capture/state', 'GET'), ('/_ci-capture/gate?id=unit', 'POST'), ('/_ci-capture/marker?id=unit', 'GET')]:
            for headers in ([self.service] if path.startswith('/functions') else [self.service, self.child]):
                with self.subTest(path=path, auth=list(headers)):
                    handler, _, _ = self.send(self.handler(path, method, headers), observe=lambda *_: self.assertEqual(gateway.state()['active'], 0))
                    self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
                    self.assert_terminal(generation=0)

    def test_control_gate_and_state_remain_available_while_application_is_active(self):
        admitted, release = threading.Event(), threading.Event()
        app = self.handler('/_ci-capture/probe?mode=delay', headers=self.child)
        application = mock.Mock()
        def pending_response():
            admitted.set()
            if not release.wait(2): raise TimeoutError()
            return response(framed())
        application.getresponse.side_effect = pending_response
        control = mock.Mock()
        control.getresponse.side_effect = lambda: response(framed())
        with mock.patch.object(gateway.http.client, 'HTTPConnection', side_effect=[application, control]):
            thread = threading.Thread(target=app.run)
            thread.start()
            try:
                self.assertTrue(admitted.wait(1))
                state_handler = self.handler('/_ci-gateway-state', headers=self.child)
                state_handler.run()
                snapshot = gateway.json.loads(state_handler.wfile.getvalue())
                self.assertEqual((snapshot['active'], snapshot['generation']), (1, 1))
                gate = self.handler('/_ci-capture/gate?id=unit', method='POST', headers=self.child)
                gate.run()
                self.assertEqual(gate.statuses, [200])
                self.assertEqual(self.fields(gate)['x-ci-upstream-complete'], '1')
                self.assertEqual((gateway.state()['active'], gateway.state()['generation']), (1, 1))
            finally:
                release.set(); thread.join(2)
            self.assertFalse(thread.is_alive())
        self.assertEqual(app.statuses, [200])
        self.assert_terminal()

    def test_public_health_unauthorized_drain_and_similar_paths_are_data(self):
        for path, method, headers in [('/functions/v1/_local-health', 'GET', {}),
                                      ('/functions/v1/_local-drain', 'POST', {}),
                                      ('/functions/v1/_local-drain/extra', 'POST', self.service),
                                      ('/functions/v1/_local-drain', 'GET', self.service)]:
            with self.subTest(path=path, method=method):
                self.setUp()
                self.send(self.handler(path, method, headers), observe=lambda *_: self.assertEqual(gateway.state()['active'], 1))
                self.assert_terminal()

    def test_capture_application_and_probe_are_fixed_authenticated_data_routes(self):
        for path, method in [('/_ci-capture/capture', 'POST'), ('/_ci-capture/probe?mode=status503', 'GET')]:
            for headers in [self.child, self.service]:
                with self.subTest(path=path, auth=list(headers)):
                    self.setUp()
                    handler, upstream, connection = self.send(self.handler(path, method, headers), framed(503),
                        observe=lambda *_: self.assertEqual(gateway.state()['active'], 1))
                    self.assertEqual(connection.call_args.args, (gateway.identity + '-capture', 8090))
                    self.assertEqual(upstream.request.call_args.args[1], path[len('/_ci-capture'):])
                    self.assertEqual(upstream.request.call_args.args[3]['x-ci-control'], gateway.control_token)
                    self.assertEqual(handler.statuses, [503])
                    self.assertEqual(self.fields(handler)['x-ci-upstream-complete'], '1')
                    self.assert_terminal()

    def test_capture_wrong_auth_methods_and_unknown_sinks_are_refused(self):
        for path, method, headers, status in [('/_ci-capture/capture', 'GET', self.child, 405),
            ('/_ci-capture/probe', 'POST', self.child, 405), ('/_ci-capture/capture', 'POST', {}, 401),
            ('/_ci-capture/capture', 'POST', {'apikey': 'unit-anon', 'authorization': 'Bearer unit-service'}, 401),
            ('/_ci-capture/state', 'GET', {'x-ci-child': 'wrong'}, 401),
            ('/_ci-capture/capture/extra', 'POST', self.child, 404),
            ('/_ci-capture/probe/extra', 'GET', self.child, 404), ('/_ci-capture/unknown', 'POST', self.child, 404),
            ('http://foreign.invalid/capture', 'POST', self.child, 400), ('/unknown', 'POST', self.child, 404)]:
            with self.subTest(path=path, method=method):
                handler, _, connection = self.send(self.handler(path, method, headers))
                self.assertEqual(handler.statuses, [status])
                connection.assert_not_called()
        self.assert_terminal(generation=0)

    def test_public_function_links_still_need_no_gateway_apikey(self):
        handler, upstream, _ = self.send(self.handler('/functions/v1/staffing-click?token=synthetic'))
        self.assertEqual(handler.statuses, [200])
        self.assertEqual(upstream.request.call_args.args[1], '/staffing-click?token=synthetic')
        self.assert_terminal()


if __name__ == '__main__':
    unittest.main()
