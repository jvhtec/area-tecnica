"""CI-only in-memory provider sink and deferred-task gates; never sends anything."""
import hmac, http.server, json, os, re, threading, time, urllib.parse, uuid

identity, token = os.environ['CI_STACK_ID'], os.environ['CI_CONTROL_TOKEN']
assert re.fullmatch(r'staffing-ci-[0-9a-f]{10}', identity) and len(token) >= 32
lock = threading.Lock()
records, gates, markers = [], set(), set()

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def reply(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def run(self):
        if not hmac.compare_digest(self.headers.get('x-ci-control', ''), token): return self.reply(401, {})
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == '/probe' and self.command == 'GET':
            mode = urllib.parse.parse_qs(parsed.query).get('mode', [''])[0]
            if mode == 'delay':
                time.sleep(1)
                return self.reply(200, {'complete': True})
            if mode == 'timeout':
                time.sleep(42)
                return self.reply(200, {'complete': True})
            if mode == 'truncated':
                self.send_response(200); self.send_header('Content-Length', '50')
                self.end_headers(); self.wfile.write(b'short'); self.wfile.flush()
                self.close_connection = True
                return
            if mode in ['status500', 'status503']: return self.reply(int(mode[-3:]), {'handled': True})
            if mode == 'plain':
                self.send_response(200); self.send_header('Content-Length', '5')
                self.end_headers(); self.wfile.write(b'plain')
                return
            return self.reply(400, {})
        if parsed.path == '/state' and self.command == 'GET':
            with lock: result = {'captured': len(records), 'kinds': [r['kind'] for r in records], 'blocked': sum(r['kind']=='blocked' for r in records)}
            return self.reply(200, result)
        if parsed.path in ['/gate', '/marker']:
            id = urllib.parse.parse_qs(parsed.query).get('id', [''])[0]
            if not re.fullmatch(r'[a-f0-9-]{36}', id): return self.reply(400, {})
            with lock:
                target = gates if parsed.path == '/gate' else markers
                if self.command == 'POST': target.add(id)
                result = {'released' if parsed.path == '/gate' else 'complete': id in target}
            return self.reply(200, result)
        if parsed.path != '/capture' or self.command != 'POST': return self.reply(404, {})
        lengths = self.headers.get_all('Content-Length') or []
        if self.headers.get('Transfer-Encoding') or len(lengths)!=1 or not re.fullmatch(r'\d{1,7}', lengths[0]): return self.reply(400, {})
        size = int(lengths[0])
        if size > 1024*1024: return self.reply(413, {})
        try:
            payload = self.rfile.read(size)
            if len(payload)!=size: return self.reply(400, {})
            value = json.loads(payload)
            kind = value['kind']
            if kind not in ['email','whatsapp','blocked']: return self.reply(400, {})
            if kind=='email':
                email = json.loads(value['body'])
                addresses = [email['sender']['email'], *[item['email'] for item in email['to']],
                  *[item['email'] for item in email.get('cc', [])], *[item['email'] for item in email.get('bcc', [])]]
                if not addresses or not all(isinstance(v,str) and re.fullmatch(r'[^@\s]+@[^@\s]+\.invalid',v) for v in addresses): return self.reply(400, {'error':'Synthetic recipients required'})
            with lock:
                if len(records)>=512: return self.reply(503, {})
                records.append(value)
            if kind=='blocked': return self.reply(400, {})
            return self.reply(201 if kind=='email' else 200, {'messageId':str(uuid.uuid4())+'@ci.invalid','id':'ci-only'})
        except (ValueError, KeyError, TypeError): return self.reply(400, {})
    do_GET = do_POST = run

class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    def handle_error(self, *_): pass

with Server(('0.0.0.0',8090),Handler) as server: server.serve_forever()
