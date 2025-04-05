export class TransferFunction {
    // Magic number to identify the transfer function file format
    public static readonly MAGIC_NUMBER = 'TF01';

    public filename: string;
    public size: number[];
    public n_colours: number;
    public data: ArrayBuffer;
    
    constructor(filename?: string) {
        this.filename = filename || '';
        this.size = [1, 1];
        this.n_colours = 1;
        this.data = new ArrayBuffer(0);
    }

    public async load(file: File): Promise<void> {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        
        // Check magic number 'TF01'
        const magic = new TextDecoder().decode(buffer.slice(0, 4));
        if (magic !== TransferFunction.MAGIC_NUMBER) {
            throw new Error('Invalid transfer function');
        }

        // Read n_colours (4 bytes after magic number)
        this.n_colours = view.getUint32(4, true);
        
        // Store the remaining data (color data)
        this.data = buffer.slice(8); // Skip magic number and n_colours
    }

    public resize(limit: number): void {
        this.size = [limit, Math.ceil(this.n_colours / limit)];
    }
}