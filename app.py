import os, sys, json, struct
from flask import Flask, render_template, Response, stream_with_context

from ossium import Volume, TransferFunction

class Server():

    def __init__(self):
        self.app = Flask(__name__)
        self.port = 8080
        self.res_path = os.path.realpath(os.path.join(os.path.dirname(__file__), sys.argv[1]))
        self.volumes = []
        self.transfer_functions = []
        self.read_resources()

    def read_resources(self):
        """Load all volume and transfer function resources from the specified directory."""
        filenames = sorted([f for f in os.listdir(self.res_path) if not f.startswith('.')])
        
        # Process each file/directory in the resources path
        for filename in filenames:
            file_path = os.path.join(self.res_path, filename)
            
            # Load transfer function files
            if filename.endswith('.tf'):
                self.transfer_functions.append(TransferFunction(file_path))
                
            # Process DICOM directories
            if os.path.isdir(file_path):
                self.volumes.append(Volume(file_path))

        self.setup()
        self.start()

    def setup(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')

        @self.app.route('/volumes')
        def volumes():
            return json.dumps([volume.__getstate__() for volume in self.volumes])

        @self.app.route('/transfer_functions')
        def transfer_functions():
            return json.dumps([tf.__getstate__() for tf in self.transfer_functions])

        @self.app.route('/volume/<string:filename>')
        def send_volume(filename = None):
            for volume in self.volumes:
                if filename == volume.filename:
                    return Response(stream_with_context(volume.stream_data()))
            return Response(status=404)

        @self.app.route('/transfer_function/<string:filename>')
        def send_transfer_function(filename = None):
            for tf in self.transfer_functions:
                if tf.filename == filename:
                    return Response(stream_with_context(tf.stream_data()))
            return Response(status=404)

    def start(self):
        self.app.run(host='0.0.0.0', port=self.port)

if __name__ == '__main__':
    server = Server()
