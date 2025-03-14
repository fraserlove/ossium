export class Context {
    private volume: any;
    private transferFunction: any;
    private volumeIDs: string[];
    private transferFunctionIDs: string[];
    private adapter: GPUAdapter;
    private device: GPUDevice;
    private queue: GPUQueue;

    private containers: Map<number, HTMLDivElement>;
    private windows: Map<number, HTMLCanvasElement>;
    private contexts: Map<number, GPUCanvasContext>;

    constructor() {
        this.volumeIDs = [];
        this.transferFunctionIDs = [];
        this.containers = new Map<number, HTMLDivElement>();
        this.windows = new Map<number, HTMLCanvasElement>();
        this.contexts = new Map<number, GPUCanvasContext>();
    }

    public getVolume(): any { return this.volume; }
    public getTransferFunction(): any { return this.transferFunction; }
    public getVolumeIDs(): string[] { return this.volumeIDs; }
    public getTransferFunctionIDs(): string[] { return this.transferFunctionIDs; }
    public getDevice(): GPUDevice { return this.device; }
    public getQueue(): GPUQueue { return this.queue; }
    public getContainer(id: number): HTMLDivElement { return this.containers.get(id); }
    public getWindow(id: number): HTMLCanvasElement { return this.windows.get(id); }
    public getGPUContext(id: number): GPUCanvasContext { return this.contexts.get(id); }
    public displayFormat(): GPUTextureFormat { return navigator.gpu.getPreferredCanvasFormat(); }

    public async loadVolume(id: string): Promise<void> {
        let volumes = await (await fetch('http://localhost:8080/volumes')).json();
        for (let i = 0; i < volumes.length; i++) {
            if (volumes[i].filename == id)  {
                this.volume = volumes[i];
                this.volume.data = await (await fetch('http://localhost:8080/volume/' + this.volume.filename)).arrayBuffer();
            }
        }
        console.log('CONTEXT: Loaded Volume ' + this.volume.filename);
    }

    public async loadTransferFunction(id: string): Promise<void> {
        let transferFunctions = await (await fetch('http://localhost:8080/transfer_functions')).json();
        for (let i = 0; i < transferFunctions.length; i++) {
            if (transferFunctions[i].filename == id)  {
                this.transferFunction = transferFunctions[i];
                this.transferFunction.data = await (await fetch('http://localhost:8080/transfer_function/' + this.transferFunction.filename)).arrayBuffer();
            }
        }
        console.log('CONTEXT: Loaded Transfer Function ' + this.transferFunction.filename);
    }

    public async init(): Promise<void> {
        await this.initVolumes();
        await this.initTransferFunctions();
    }

    private async initVolumes(): Promise<void> {
        console.log('CONTEXT: Loading Volume...');
        let volumes = await (await fetch('http://localhost:8080/volumes')).json();
        for (let i = 0; i < volumes.length; i++) this.volumeIDs.push(volumes[i].filename);
        await this.loadVolume(volumes[0].filename);
    }

    private async initTransferFunctions(): Promise<void> {
        console.log('CONTEXT: Loading Transfer Function...');
        let transferFunctions = await (await fetch('http://localhost:8080/transfer_functions')).json();
        for (let i = 0; i < transferFunctions.length; i++) this.transferFunctionIDs.push(transferFunctions[i].filename);
        await this.loadTransferFunction(transferFunctions[0].filename);
    }

    public newWindow(renderID: number): HTMLCanvasElement {
        let container = document.createElement('div');
        container.id = 'container';
        this.containers.set(renderID, container);

        let window = document.createElement('canvas');
        this.windows.set(renderID, window);

        let context = window.getContext('webgpu');
        context.configure({ device: this.device, format: this.displayFormat(), alphaMode: 'premultiplied' });
        this.contexts.set(renderID, context);
            
        container.appendChild(window);
        document.body.appendChild(container);
        return window;
    }

    public removeWindow(id: number): void {
        this.containers.get(id).remove();
        this.containers.delete(id);
        this.windows.delete(id);
        this.contexts.delete(id);
    }

    public resizeWindow(id: number, size: number[]): void { 
        this.windows.get(id).width = size[0];
        this.windows.get(id).height = size[1];
    }

    public async initWebGPU(): Promise<boolean> {
        console.log('CONTEXT: Initialising WebGPU...');
        try {
            this.adapter = await navigator.gpu.requestAdapter();
            
            // Check adapter limits and request higher buffer size limit
            const adapterLimits = this.adapter.limits;
            const requiredLimits = {
                maxStorageBufferBindingSize: Math.min(4294967296, adapterLimits.maxStorageBufferBindingSize),
                maxBufferSize: Math.min(4294967296, adapterLimits.maxStorageBufferBindingSize)
            };
            
            this.device = await this.adapter.requestDevice({
                requiredLimits: requiredLimits
            });
            
            this.queue = this.device.queue;
        }
        catch(error) {
            console.error(error);
            console.log('CONTEXT: WebGPU Not Supported.');
            return false;
        }
        console.log('CONTEXT: Initialised WebGPU.');
        this.transferFunction.size = [this.device.limits.maxTextureDimension1D, Math.ceil(this.transferFunction.n_colours / this.device.limits.maxTextureDimension1D)];
        console.log(this.transferFunction.size);
        return true;
    }
}