import * as daikon from 'daikon';

export class Volume {
    public filename: string;
    public size: number[];
    public bitsPerVoxel: number;
    public bytesPerLine: number;
    public signed: boolean;
    public boundingBox: number[];
    public textureFormat: GPUTextureFormat;
    public data: ArrayBuffer;

    /**
     * Creates a new Volume instance
     * @param filename Optional name of the volume
     */
    constructor(filename?: string) {
        this.filename = filename || '';
        this.size = [1, 1, 1];
        this.bitsPerVoxel = 16;
        this.bytesPerLine = 0;
        this.signed = false;
        this.boundingBox = [0, 0, 0];
        this.textureFormat = 'rg8unorm';
        this.data = new ArrayBuffer(0);
    }

    /**
     * Loads a Volume from a set of DICOM files
     * @param files Array of DICOM files to load
     * @throws Error if no files provided or format is invalid
     */
    public async load(files: File[]): Promise<void> {
        if (files.length === 0) {
            throw new Error('No DICOM files provided');
        }

        const series = new daikon.Series();
        
        // Process each file
        for (const file of files) {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const image = daikon.Series.parseImage(new DataView(arrayBuffer));
            
            if (!image) {
                console.error('Error parsing DICOM file:', daikon.Series.parserError);
            } else if (image.hasPixelData()) {
                // Add image if it's the first one or part of the same series
                if (series.images.length === 0 || image.getSeriesId() === series.images[0].getSeriesId()) {
                    series.addImage(image);
                }
            }
        }
        
        // Order the image files, determine number of frames, etc.
        series.buildSeries();
        
        if (series.images.length === 0) {
            throw new Error('No valid DICOM images found');
        }
        
        // Extract volume properties
        const firstImage = series.images[0];
        this.size = [firstImage.getRows(), firstImage.getCols(), series.images.length];
        this.bitsPerVoxel = firstImage.getBitsAllocated();
        this.bytesPerLine = this.size[0] * (this.bitsPerVoxel / 8);
        this.signed = firstImage.getPixelRepresentation() === 1;
        
        // Calculate bounding box using pixel spacing
        const pixelSpacing = firstImage.getPixelSpacing() || [1, 1];
        this.boundingBox = [
            this.size[0] * pixelSpacing[0],
            this.size[1] * pixelSpacing[1],
            this.size[2] * (firstImage.getSliceThickness() || 1)
        ];
        
        // Using 16-bit texture format - red(low bits), green(high bits)
        this.textureFormat = 'rg8unorm' as GPUTextureFormat;
        
        if (this.bitsPerVoxel !== 16) {
            throw new Error(`Unsupported bits per voxel: ${this.bitsPerVoxel}`);
        }
        
        // Create volume data buffer
        const totalVoxels = this.size[0] * this.size[1] * this.size[2];
        const volumeData = new Uint16Array(totalVoxels);
        const shift = 2 ** 15;
        
        // Process each slice
        for (let i = 0; i < series.images.length; i++) {
            const image = series.images[i];
            const pixelData = image.getInterpretedData();
            const sliceSize = this.size[0] * this.size[1];
            const sliceOffset = i * sliceSize;
            
            const rescaleSlope = image.getDataScaleSlope() || 1;
            const rescaleIntercept = image.getDataScaleIntercept() || 0;
            
            // Apply rescaling to each voxel
            for (let j = 0; j < sliceSize; j++) {
                volumeData[sliceOffset + j] = Math.round(rescaleSlope * pixelData[j] + shift);
            }
        }
        
        this.data = volumeData.buffer;
    }

    /**
     * Reads a File as ArrayBuffer
     * @param file File to read
     * @returns Promise resolving to ArrayBuffer
     */
    private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            fileReader.onerror = () => reject('Error reading file');
            fileReader.readAsArrayBuffer(file);
        });
    }
}