import * as daikon from 'daikon';

export class Volume {
    public name: string;
    public size: number[];
    public bytesPerVoxel: number;
    public signed: boolean;
    public boundingBox: number[];
    public data: ArrayBuffer;

    /**
     * Creates a new Volume instance
     * @param name Optional name of the volume
     */
    constructor(name?: string) {
        this.name = name || '';
        this.size = [1, 1, 1];
        this.bytesPerVoxel = 2;
        this.signed = false;
        this.boundingBox = [0, 0, 0];
        this.data = new ArrayBuffer(0);
    }

    /**
     * Loads a Volume from a set of DICOM files
     * @param files Array of DICOM files to load
     * @throws Error if no files provided or format is invalid
     */
    public async load(files: File[]): Promise<void> {
        if (!files.length) throw new Error('No DICOM files provided');

        const series = new daikon.Series();
        
        // Load all files into the series
        for (const file of files) {
            const buffer = await file.arrayBuffer();
            const image = daikon.Series.parseImage(new DataView(buffer));
            
            if (image?.hasPixelData()) {
                series.addImage(image);
            }
        }
        
        series.buildSeries();
        
        if (!series.images.length) throw new Error('No valid DICOM images found');
        
        // Extract volume properties
        const firstImage = series.images[0];
        this.size = [firstImage.getRows(), firstImage.getCols(), series.images.length];
        this.bytesPerVoxel = firstImage.getBitsAllocated() / 8;
        this.signed = firstImage.getPixelRepresentation() === 1;
        
        // Calculate bounding box using pixel spacing
        const pixelSpacing = firstImage.getPixelSpacing() || [1, 1];
        this.boundingBox = [
            this.size[0] * pixelSpacing[0],
            this.size[1] * pixelSpacing[1],
            this.size[2] * (firstImage.getSliceThickness() || 1)
        ];
        
        if (this.bytesPerVoxel !== 2) throw new Error(`Unsupported bytes per voxel: ${this.bytesPerVoxel}`);
        
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
        console.log(this.signed);
        
        this.data = volumeData.buffer;
    }
}