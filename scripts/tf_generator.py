import struct
import os
from typing import Dict, List, Optional
import numpy as np
import matplotlib.pyplot as plt

class TransferFunction:
    MAGIC_NUMBER = b'TF01'  # Magic number to identify the transfer function file format
    
    def __init__(self) -> None:
        self.n_colours: int = 0
        self._data: Optional[bytes] = None

    def save(self, output_filename: str) -> None:
        """Create a new transfer function file"""
        with open(output_filename, 'wb') as f:
            # Write magic number
            f.write(TransferFunction.MAGIC_NUMBER)
            # Write header
            f.write(struct.pack('I', self.n_colours))
            # Write colour data
            f.write(self._data)

    @classmethod
    def create(cls, colours: np.ndarray) -> 'TransferFunction':
        """
        Create a transfer function from a numpy array of RGBA colours
        
        Args:
            colours: numpy array of shape (n, 4) with float32 values
            
        Returns:
            A new TransferFunction instance
        """
        tf = cls()
        tf.n_colours = len(colours)
        tf._data = colours.astype(np.float32).tobytes()
        return tf
    
    def plot(self, output_path: Optional[str] = None) -> None:
        """
        Plot a visualisation of the transfer function
        
        Args:
            output_path: if provided, save the plot to this path
        """
        # Convert bytes back to numpy array
        colours = np.frombuffer(self._data, dtype=np.float32).reshape(self.n_colours, 4)
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(16, 8), gridspec_kw={'height_ratios': [1, 3]})
        
        # Plot the colour map
        # Create a 2D array where each row is the same colour
        colour_map = np.zeros((50, self.n_colours, 3))
        for i in range(self.n_colours):
            colour_map[:, i, :] = colours[i, :3]  # RGB values
        
        ax1.imshow(colour_map, aspect='auto', extent=[0, self.n_colours, 0, 1])
        ax1.set_yticks([])
        ax1.set_title('Colour Map')
        
        # Plot the RGBA components
        x = np.arange(self.n_colours)
        ax2.plot(x, colours[:, 0], 'r-', label='Red')
        ax2.plot(x, colours[:, 1], 'g-', label='Green')
        ax2.plot(x, colours[:, 2], 'b-', label='Blue')
        ax2.plot(x, colours[:, 3], 'k--', label='Alpha')
        ax2.set_xlabel('Intensity Value')
        ax2.set_ylabel('Component Value')
        ax2.set_title('RGBA Components')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if output_path:
            plt.savefig(output_path)
        
        plt.show()

def create_basic_tf(n_colours: int = 8192, output_path: str = 'basic.tf') -> None:
    """
    Create a transfer function for basic visualization
    
    Args:
        n_colours: number of colours in the transfer function (default 8192)
        output_path: where to save the transfer function file (default 'blood.tf')
    
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
    key_points: Dict[int, List[float]] = {
        #      r    g    b    a
        0:    [0.0, 0.0, 0.0, 0.0], # Air
        4100: [0.0, 0.0, 0.0, 0.0],
        4140: [1.0, 0.0, 0.0, 0.4], # Blood
        4150: [0.0, 0.0, 0.0, 0.0],
        4200: [0.9, 0.9, 0.7, 0.9], # Bone
    }
    
    # Interpolate between key points
    points = sorted(key_points.keys())
    for i in range(len(points)-1):
        start_idx = points[i]
        end_idx = points[i+1]
        start_colour = key_points[start_idx]
        end_colour = key_points[end_idx]
        
        # Linear interpolation between key points
        for idx in range(start_idx, end_idx + 1):
            if idx < n_colours:
                t = (idx - start_idx) / (end_idx - start_idx)
                colours[idx] = np.array(start_colour) * (1-t) + np.array(end_colour) * t
    
    # Fill in any remaining indices with the last colour
    if points[-1] < n_colours - 1:
        colours[points[-1]+1:] = key_points[points[-1]]
    
    tf = TransferFunction.create(colours)
    tf.save(output_path)
    tf.plot()

if __name__ == '__main__':
    create_basic_tf()