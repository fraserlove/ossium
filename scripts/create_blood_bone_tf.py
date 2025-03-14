import struct
import os
import numpy as np

class TransferFunction:
    MAGIC_NUMBER = b'TF01'  # Magic number to identify our transfer function file format
    
    def __init__(self):
        self.n_colours = 0
        self._data = None

    def save(self, output_filename):
        """Create a new transfer function file"""
        with open(output_filename, 'wb') as f:
            # Write magic number
            f.write(TransferFunction.MAGIC_NUMBER)
            
            # Write header
            f.write(struct.pack('I', self.n_colours))
            
            # Write color data
            f.write(self._data)

    @classmethod
    def create(cls, colours):
        """
        Create a transfer function from a numpy array of RGBA colours
        colours: numpy array of shape (n, 4) with float32 values
        """
        tf = cls()
        tf.n_colours = len(colours)
        tf._data = colours.astype(np.float32).tobytes()
        return tf

def create_blood_bone_tf(n_colours=2048, output_path='blood.tf'):
    """
    Create a transfer function for blood and bone visualization
    
    Parameters:
    n_colours: number of colours in the transfer function (default 2048)
    output_path: where to save the transfer function file (default 'blood_bone.tf')
    
    The transfer function is designed to show only blood vessels and bone:
    - Air/Background: fully transparent
    - Soft tissue: fully transparent
    - Skin: fully transparent
    - Blood vessels: bright red, semi-transparent
    - Bone: white/ivory, mostly opaque
    """
    
    # Create array for colours
    colours = np.zeros((n_colours, 4), dtype=np.float32)
    
    # Define key density points and their RGBA values
    # Values are normalized to [0, 1]
    key_points = {
        # idx: [R, G, B, A]
        0:    [0.0, 0.0, 0.0, 0.0],  # Air
        1100: [0.0, 0.0, 0.0, 0.0],
        1150: [1.0, 0.0, 0.0, 0.4],  # Blood vessels (bright red, semi-transparent)
        1200: [0.0, 0.0, 0.0, 0.0],  # Transition to bone - increased threshold
        1300: [0.9, 0.9, 0.7, 0.9],  # Start of bone (ivory color, more opaque)
    }
    
    # Interpolate between key points
    points = sorted(key_points.keys())
    for i in range(len(points)-1):
        start_idx = points[i]
        end_idx = points[i+1]
        start_color = key_points[start_idx]
        end_color = key_points[end_idx]
        
        # Linear interpolation between key points
        for idx in range(start_idx, end_idx + 1):
            if idx < n_colours:  # Ensure we don't go out of bounds
                t = (idx - start_idx) / (end_idx - start_idx)
                colours[idx] = np.array(start_color) * (1-t) + np.array(end_color) * t
    
    # Fill in any remaining indices with the last color
    if points[-1] < n_colours - 1:
        colours[points[-1]+1:] = key_points[points[-1]]
    
    # Create and save the transfer function
    tf = TransferFunction.create(colours)
    tf.save(output_path)
    print(f"Created transfer function file: {output_path}")

if __name__ == '__main__':
    create_blood_bone_tf() 