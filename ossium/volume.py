import os
import pydicom
import numpy as np

class Volume:
    def __init__(self, dirpath):
        self.dirpath = dirpath  # Store the full path privately
        self.filename = os.path.basename(dirpath)  # Use directory name as filename
        self.load(dirpath)

    def __getstate__(self):
        """Return a JSON-serializable state dictionary"""
        state = self.__dict__.copy()
        state.pop('dirpath', None)  # Remove private path from serialization
        return state

    def load(self, dirpath):
        dcm_files = [f for f in os.listdir(dirpath) if f.endswith('.dcm')]
        
        if not dcm_files:
            raise ValueError(f"No DICOM files found in {dirpath}")
        
        # Sort DICOM files by Instance Number if available
        dcm_with_instance = []
        for filename in dcm_files:
            dcm = pydicom.dcmread(os.path.join(dirpath, filename), stop_before_pixels=True)
            instance_number = getattr(dcm, 'InstanceNumber', 0)
            dcm_with_instance.append((filename, instance_number))
        
        # Sort by instance number
        dcm_files = [f for f, _ in sorted(dcm_with_instance, key=lambda x: x[1])]
            
        # Read the first DICOM file to get metadata
        sample_dcm = pydicom.dcmread(os.path.join(dirpath, dcm_files[0]))
        self.size = [int(sample_dcm.Rows), int(sample_dcm.Columns), len(dcm_files)]
        self.bitsPerVoxel = sample_dcm.BitsAllocated
        self.bytesPerLine = self.size[0] * (self.bitsPerVoxel // 8)
        self.signed = sample_dcm.PixelRepresentation
        # Calculate bounding box using pixel spacing
        pixel_spacing = sample_dcm.PixelSpacing[0]
        self.boundingBox = [
            self.size[0] * pixel_spacing,  # width in mm
            self.size[1] * pixel_spacing,  # height in mm
            self.size[2] * pixel_spacing   # depth in mm
        ]
        if self.bitsPerVoxel == 8:
            self.textureFormat = 'r8unorm'
        elif self.bitsPerVoxel == 16:
            self.textureFormat = 'rg8unorm'
        else:
            raise Exception('Invalid bits per voxel for volume texture.')

    def stream_data(self):
        """Stream DICOM volume data chunk by chunk."""
        # Find and sort DICOM files by Instance Number
        dcm_files = [f for f in os.listdir(self.dirpath) if f.endswith('.dcm')]
        dcm_with_instance = []
        for filename in dcm_files:
            dcm = pydicom.dcmread(os.path.join(self.dirpath, filename), stop_before_pixels=True)
            instance_number = getattr(dcm, 'InstanceNumber', 0)
            dcm_with_instance.append((filename, instance_number))
        
        # Process files in correct order
        for file, _ in sorted(dcm_with_instance, key=lambda x: x[1]):
            meta = pydicom.dcmread(os.path.join(self.dirpath, file))
            rescaleSlope = 1 if meta.get('RescaleSlope') is None else meta.RescaleSlope
            rescaleIntercept = 0 if meta.get('RescaleIntercept') is None else meta.RescaleIntercept
            out = (rescaleSlope * meta.pixel_array + rescaleIntercept) + 2 ** 15 - rescaleIntercept
            yield out.astype(np.uint16).tobytes()