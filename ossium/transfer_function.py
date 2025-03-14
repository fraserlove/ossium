import struct
import os

class TransferFunction:
    MAGIC_NUMBER = b'TF01'  # Magic number to identify our transfer function file format
    
    def __init__(self, filepath):
        self.filepath = filepath  # Store full path privately
        self.filename = os.path.basename(filepath)  # Store just the filename for the API
        self.load(filepath)

    def __getstate__(self):
        """Return a JSON-serializable state dictionary"""
        state = self.__dict__.copy()
        # Remove private attributes from serialization
        state.pop('_data', None)
        state.pop('filepath', None)
        return state

    def load(self, filepath):
        """Load transfer function from a single .tf file"""
        with open(filepath, 'rb') as f:
            # Verify magic number
            magic = f.read(4)
            if magic != self.MAGIC_NUMBER:
                raise ValueError("Invalid transfer function file format")
            
            self.n_colours = struct.unpack('I', f.read(4))[0]
            self._data = f.read()

    def save(self, output_filename):
        """Create a new transfer function file"""
        with open(output_filename, 'wb') as f:
            # Write magic number
            f.write(TransferFunction.MAGIC_NUMBER)
            
            # Write header
            f.write(struct.pack('I', self.n_colours))
            
            # Write color data
            f.write(self._data)

    def stream_data(self):
        """Stream transfer function data."""
        # Skip header (magic number + n_colours = 8 bytes)
        yield self._data