"""Optional local-only CI migration ingress, fixed to its synthetic database."""
import re, select, socket, socketserver, sys

target=sys.argv[1]
assert re.fullmatch(r'supabase_db_staffing-ci-[a-f0-9]{10}',target)

class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            with socket.create_connection((target,5432),timeout=5) as upstream:
                self.request.settimeout(120); upstream.settimeout(120)
                peers={self.request:upstream,upstream:self.request}; live=list(peers)
                while live:
                    readable,_,_=select.select(live,[],[],120)
                    if not readable:return
                    for source in readable:
                        data=source.recv(65536)
                        if data:peers[source].sendall(data)
                        else:live.remove(source);peers[source].shutdown(socket.SHUT_WR)
        except (OSError,TimeoutError):return

class Server(socketserver.ThreadingTCPServer):
    address_family=socket.AF_INET
    allow_reuse_address=True
    daemon_threads=True

with Server(('0.0.0.0',5432),Relay) as server:server.serve_forever()
