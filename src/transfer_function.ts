export class TransferFunction {
    // Magic number to identify the transfer function file format
    public static readonly MAGIC_NUMBER = 'TF01';

    private _name: string;
    private _size: number;
    private _data: ArrayBuffer;
    
    constructor(name?: string) {
        this._name = name || '';
        this._size = 1;
        this._data = new ArrayBuffer(0);
    }

    public get name(): string { return this._name; }
    public get size(): number { return this._size; }
    public get data(): ArrayBuffer { return this._data; }

    public async load(file: File): Promise<void> {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        
        // Check magic number 'TF01'
        const magic = new TextDecoder().decode(buffer.slice(0, 4));
        if (magic !== TransferFunction.MAGIC_NUMBER) {
            throw new Error('Invalid transfer function');
        }

        // Read size of transfer function (4 bytes after magic number)
        this._size = view.getUint32(4, true);
        
        // Store the remaining data (color data)
        this._data = buffer.slice(8); // Skip magic number and size
    }
}