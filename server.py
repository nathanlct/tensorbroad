import http.server
import socketserver
import os.path
import csv
from collections import defaultdict
import sys


class CustomHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        self.csv_paths = []
        self.logdir = sys.argv[1]
        print('Logdir: ', os.path.expanduser(self.logdir))

        script_folder = '/'.join(os.path.realpath(__file__).split('/')[:-1])
        super().__init__(*args, directory=script_folder, **kwargs)
        

    def do_GET(self):
        """Handles GET requests."""
        if self.path == "/get_csv_paths":
            # get paths of csv files in logdir
            self.send_response(200)
            self.end_headers()
            self.reload_csv_paths()
            self.wfile.write('\n'.join(self.csv_paths).encode())
        elif self.path.startswith("/get_csv_file/"):
            # get content of csv file
            self.send_response(200)
            self.end_headers()
            csv_path = self.path[len("/get_csv_file/"):]
            with open(os.path.join(os.path.expanduser(self.logdir), csv_path), "rb") as csv_file:
                contents = csv_file.read()
            self.wfile.write(contents)
        else:
            super().do_GET()


    def reload_csv_paths(self):
        """Find and save path of all progress.csv files in logdir"""
        self.csv_paths = []

        root = os.path.expanduser(self.logdir)
        for (dirpath, _, filenames) in os.walk(root):
            if 'progress.csv' in filenames:
                self.csv_paths.append(os.path.join(os.path.relpath(dirpath, root), 'progress.csv'))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('usage: python server.py <logdir>')
    else:
        port = 1234
        while True:
            try:
                with socketserver.TCPServer(("", port), CustomHandler) as httpd:
                    print('Serving at address http://localhost:' + str(port) + '/main.html (Press CTRL+C to quit)')
                    httpd.serve_forever()
            except OSError as e:
                print(e)
                port += 1
