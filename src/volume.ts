import * as daikon from 'daikon';

export class Volume {
    private _name: string;
    private _size: number[];
    private _bytesPerVoxel: number;
    private _signed: boolean;
    private _scale: number[];
    private _data: ArrayBuffer;

    constructor(name?: string) {
        this._name = name || '';
        this._size = [1, 1, 1];
        this._bytesPerVoxel = 2;
        this._signed = false;
        this._scale = [1, 1, 1];
        this._data = new ArrayBuffer(0);
    }

    public get name(): string { return this._name; }
    public get size(): number[] { return this._size; }
    public get bytesPerVoxel(): number { return this._bytesPerVoxel; }
    public get signed(): boolean { return this._signed; }
    public get scale(): number[] { return this._scale; }
    public get data(): ArrayBuffer { return this._data; }
    public get bounds(): number[] { return this._size.map((s, i) => s / this._scale[i]); }

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
        this._size = [firstImage.getRows(), firstImage.getCols(), series.images.length];
        this._bytesPerVoxel = firstImage.getBitsAllocated() / 8;
        this._signed = firstImage.getPixelRepresentation() === 1;

        if (this._bytesPerVoxel !== 2) throw new Error(`Unsupported bytes per voxel: ${this._bytesPerVoxel}`);
        
        // Calculate scale factors from voxel dimensions
        const pixelSpacing = firstImage.getPixelSpacing() || [1, 1];
        const sliceThickness = firstImage.getSliceThickness() || 1;
        this._scale = [pixelSpacing[0], pixelSpacing[1], sliceThickness];
        
        // Create volume data buffer
        const totalVoxels = this._size[0] * this._size[1] * this._size[2];
        const volumeData = new Uint16Array(totalVoxels);
        const shift = 2 ** 15;
        
        // Process each slice
        for (let i = 0; i < series.images.length; i++) {
            const image = series.images[i];
            const pixelData = image.getInterpretedData();
            const sliceSize = this._size[0] * this._size[1];
            const sliceOffset = i * sliceSize;
            
            const rescaleSlope = image.getDataScaleSlope() || 1;
            const rescaleIntercept = image.getDataScaleIntercept() || 0;
            
            // Apply rescaling to each voxel
            for (let j = 0; j < sliceSize; j++) {
                volumeData[sliceOffset + j] = Math.round(rescaleSlope * pixelData[j] + shift);
            }
        }

        this._data = volumeData.buffer;
    }
}