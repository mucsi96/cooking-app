"""Run the built UI in Chromium with separate document and Blob-like asset origins."""
from functools import partial
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlsplit


def main(directory):
    records = []

    class Assets(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            records.append({'origin': 'assets', 'path': self.path, 'cookie': self.headers.get('Cookie'),
                            'authorization': self.headers.get('Authorization')})
            if not self.path.startswith('/assets/') or urlsplit(self.path).path.endswith('/index.html'):
                self.send_error(404)
                return
            self.path = self.path.removeprefix('/assets')
            super().do_GET()

        def end_headers(self):
            if self.headers.get('Origin') == app_origin and 'no-cors' not in self.path:
                self.send_header('Access-Control-Allow-Origin', app_origin)
                self.send_header('Vary', 'Origin')
            super().end_headers()

        def list_directory(self, path):
            self.send_error(404)

    class Documents(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            records.append({'origin': 'app', 'path': self.path})
            path = urlsplit(self.path).path
            if path == '/api/recipes':
                body = b'[]'
                content_type = 'application/json'
            elif path == '/oauth2/userinfo':
                body = b'{"email":"owner@example.test","additionalClaims":{"name":"Owner"}}'
                content_type = 'application/json'
            elif path in ['/', '/index.html'] or 'text/html' in self.headers.get('Accept', ''):
                body = (Path(prepared) / 'documents/index.html').read_bytes()
                content_type = 'text/html'
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    with tempfile.TemporaryDirectory(dir=os.environ.get('RUNNER_TEMP', '/tmp/opencode')) as prepared:
        app = ThreadingHTTPServer(('127.0.0.1', 0), Documents)
        assets = ThreadingHTTPServer(('127.0.0.1', 0), partial(Assets, directory=str(Path(prepared) / 'assets')))
        app_origin = f'http://localhost:{app.server_port}'
        asset_base_url = f'http://127.0.0.1:{assets.server_port}/assets/'
        subprocess.run(['node', str(Path(__file__).with_name('prepare-client.mjs')),
                        directory, prepared, asset_base_url, app_origin], check=True)
        for server in [app, assets]:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            subprocess.run(['node', str(Path(__file__).resolve().parents[1] / 'test/static-assets.mjs'),
                            app_origin, asset_base_url], check=True)
            asset_requests = [item for item in records if item['origin'] == 'assets']
            assert asset_requests and all(not item['cookie'] and not item['authorization'] for item in asset_requests)
            assert any(item['origin'] == 'app' and item['path'] == '/api/recipes' for item in records)
            assert not any(item['origin'] == 'app' and urlsplit(item['path']).path.endswith(
                ('.js', '.css', '.png', '.woff2', '.webmanifest')) for item in records)
            print('Direct assets: CORS, lazy modules, fonts, icons, manifest and same-origin API passed')
        finally:
            for server in [app, assets]:
                server.shutdown()
                server.server_close()


if __name__ == '__main__':
    main(*sys.argv[1:])
