"""CI-only fixed-destination HTTP gateway. No traffic or credential logging."""
import contextlib, hmac, http.client, http.server, json, os, re, threading, urllib.parse, uuid

identity = os.environ['CI_STACK_ID']
assert re.fullmatch(r'staffing-ci-[0-9a-f]{10}',identity)
keys = {os.environ['CI_ANON_KEY'], os.environ['CI_SERVICE_KEY']}
service_key, control_token = os.environ['CI_SERVICE_KEY'], os.environ['CI_CONTROL_TOKEN']
assert len(control_token) >= 32
routes = {'/auth/v1/':(identity+'-auth',9999), '/rest/v1/':(identity+'-rest',3000), '/functions/v1/':(identity+'-edge',9000)}
allowed = {'authorization','apikey','content-type','accept','prefer','range','range-unit','accept-profile','content-profile','x-ci-child'}
request_limit, response_limit = 1024*1024, 16*1024*1024
lock, boot = threading.Lock(), str(uuid.uuid4())
generation, active, uncertainty = 0, 0, 0

class HeaderReader:
    def __init__(self, stream): self.stream, self.lastline = stream, None
    def readline(self, *args):
        self.lastline=self.stream.readline(*args)
        return self.lastline
    def __getattr__(self, name): return getattr(self.stream,name)

class CertifiedResponse(http.client.HTTPResponse):
    # The standard parser tolerates EOF in headers/trailers and does not check
    # chunk data's CRLF. Those tolerances cannot certify transport completion.
    def begin(self):
        if self.headers is not None: return
        reader=HeaderReader(self.fp); self.fp=reader
        super().begin()
        if reader.lastline!=b'\r\n': raise http.client.HTTPException('Incomplete upstream headers')
    def _read_next_chunk_size(self):
        line=self.fp.readline(65537)
        if len(line)>65536 or not re.fullmatch(rb'[0-9a-fA-F]+(?:;[^\r\n]*)?\r\n',line):
            raise http.client.HTTPException('Invalid upstream chunk size')
        return int(line.split(b';',1)[0],16)
    def _read_and_discard_trailer(self):
        for _ in range(101):
            line=self.fp.readline(65537)
            if line==b'\r\n': return
            if len(line)>65536 or not line.endswith(b'\r\n') or b':' not in line:
                raise http.client.HTTPException('Incomplete upstream chunk trailer')
        raise http.client.HTTPException('Too many upstream trailers')
    def _get_chunk_left(self):
        left=self.chunk_left
        if not left:
            if left is not None and self._safe_read(2)!=b'\r\n':
                raise http.client.HTTPException('Invalid upstream chunk separator')
            left=self._read_next_chunk_size()
            if left==0:
                self._read_and_discard_trailer(); self._close_conn(); left=None
            self.chunk_left=left
        return left

def state():
    with lock: return {'protocol':1, 'boot':boot, 'generation':generation, 'active':active, 'uncertainty':uncertainty}

def complete_body(response, method):
    """Only a fully consumed, bounded HTTP message certifies upstream receipt."""
    lengths = [v.strip() for k,v in response.getheaders() if k.lower()=='content-length']
    encodings = [v.strip().lower() for k,v in response.getheaders() if k.lower()=='transfer-encoding']
    if len(lengths)>1 or len(encodings)>1 or (lengths and encodings): raise ValueError('Ambiguous upstream framing')
    if lengths and not re.fullmatch(r'\d+',lengths[0]): raise ValueError('Invalid upstream length')
    if encodings and (encodings!=['chunked'] or not response.chunked): raise ValueError('Unsupported upstream encoding')
    if method=='HEAD' or 100<=response.status<200 or response.status in (204,205,304): return b''
    if lengths:
        size=int(lengths[0])
        if size>response_limit: raise ValueError('Upstream body exceeds limit')
        body=response.read(size+1)
        if len(body)!=size or not response.isclosed(): raise ValueError('Truncated upstream body')
        return body
    if not encodings: raise ValueError('Unframed upstream body')
    body=response.read(response_limit+1)
    if len(body)>response_limit or not response.isclosed(): raise ValueError('Incomplete or oversized chunked body')
    return body

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *_): pass
    def setup(self):
        super().setup(); self.connection.settimeout(45)
    def reply(self, status, body=b'', headers=None):
        self.send_response(status)
        for name,value in (headers or {}).items(): self.send_header(name,value)
        self.send_header('Content-Length',str(len(body))); self.send_header('Connection','close')
        self.end_headers()
        if self.command!='HEAD': self.wfile.write(body)
        self.wfile.flush()
        self.close_connection=True
    def header(self, name):
        values=self.headers.get_all(name) or []
        return values[0] if len(values)==1 else ''
    def secret(self, name, expected):
        return hmac.compare_digest(self.header(name).encode('utf8'),expected.encode('utf8'))
    def uncompleted(self, status, accounted):
        global uncertainty
        if accounted:
            with lock: uncertainty=1
        return self.reply(status,headers={'x-ci-transport-uncertain':'1'})
    def run(self):
        global generation, active, uncertainty
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith('/'): return self.reply(400)
        service_bearer=self.secret('authorization','Bearer '+service_key)
        service_auth=self.secret('apikey',service_key) and service_bearer
        child_auth=self.secret('x-ci-child',control_token)
        if parsed.path=='/_ci-gateway-state':
            if not (service_auth or child_auth): return self.reply(401)
            if self.command!='GET': return self.reply(405)
            return self.reply(200,json.dumps(state()).encode(),{'Content-Type':'application/json'})
        prefix = next((p for p in routes if parsed.path.startswith(p)),None)
        capture = parsed.path.startswith('/_ci-capture/')
        # The runtime enforces each function's JWT policy and its own service controls.
        # Requiring an API key here would reject public capability links before that policy.
        function_route = prefix=='/functions/v1/'
        if not prefix and not capture: return self.reply(404)
        path=parsed.path[len('/_ci-capture'):] if capture else parsed.path[len(prefix)-1:]
        capture_control=capture and ((path=='/state' and self.command=='GET') or (path in ['/gate','/marker'] and self.command in ['GET','POST']))
        if capture:
            if path in ['/capture','/probe']:
                if not (service_auth or child_auth): return self.reply(401)
                if self.command!=('POST' if path=='/capture' else 'GET'): return self.reply(405)
            else:
                if not (child_auth or (self.header('apikey') in keys and service_bearer)): return self.reply(401)
                if not capture_control: return self.reply(404)
        elif not function_route and self.header('apikey') not in keys: return self.reply(401)
        function_control=function_route and service_bearer and (
            (path in ['/_local-drain','/_local-release','/_local-bootstrap'] and self.command=='POST') or
            (path=='/_local-health' and self.command=='GET'))
        accounted=not (capture_control or function_control)
        certified=False
        if accounted:
            with lock: active+=1; generation+=1
        host,port=(identity+'-capture',8090) if capture else routes[prefix]
        path += '?'+parsed.query if parsed.query else ''
        headers={k:v for k,v in self.headers.items() if k.lower() in allowed}
        headers['Host']=host+':'+str(port)
        if capture: headers['x-ci-control']=control_token
        try:
            lengths=self.headers.get_all('Content-Length') or ['0']
            if self.headers.get('Transfer-Encoding') or len(lengths)!=1 or not re.fullmatch(r'\d{1,7}',lengths[0]):
                return self.uncompleted(400,accounted)
            size=int(lengths[0])
            if size>request_limit: return self.uncompleted(413,accounted)
            payload=self.rfile.read(size)
            if len(payload)!=size: return self.uncompleted(400,accounted)
            with contextlib.closing(http.client.HTTPConnection(host,port,timeout=40)) as upstream:
                upstream.response_class=CertifiedResponse
                upstream.request(self.command,path,payload,headers)
                response=upstream.getresponse(); body=complete_body(response,self.command)
                certified=True
                returned={k:v for k,v in response.getheaders() if k.lower() in {'content-type','content-range','preference-applied','location','www-authenticate'}}
                returned['x-ci-upstream-complete']='1'
                return self.reply(response.status,body,returned)
        except Exception:
            if certified:
                # Receipt is already proven; a downstream disconnect cannot undo it.
                self.close_connection=True
                return
            return self.uncompleted(502,accounted)
        finally:
            if accounted:
                with lock:
                    if not certified: uncertainty=1
                    active-=1; generation+=1
    do_GET=do_HEAD=do_POST=do_PATCH=do_DELETE=do_PUT=do_OPTIONS=run

class Server(http.server.ThreadingHTTPServer):
    daemon_threads=True
    def handle_error(self,*_): pass

if __name__=='__main__':
    with Server(('0.0.0.0',8000),Handler) as server: server.serve_forever()
