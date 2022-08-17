export class Context {
    private volume: any;
    private transferFunction: any;
    private adapter: GPUAdapter;
    private device: GPUDevice;
    private queue: GPUQueue;

    private containers: Map<number, HTMLDivElement>;
    private windows: Map<number, HTMLCanvasElement>;
    private contexts: Map<number, GPUCanvasContext>;

    constructor() {
        this.containers = new Map<number, HTMLDivElement>();
        this.windows = new Map<number, HTMLCanvasElement>();
        this.contexts = new Map<number, GPUCanvasContext>();
    }

    public getVolume(): any { return this.volume; }
    public getTransferFunction(): any { return this.transferFunction; }
    public getDevice(): GPUDevice { return this.device; }
    public getQueue(): GPUQueue { return this.queue; }
    public getContainer(id: number): HTMLDivElement { return this.containers.get(id); }
    public getWindow(id: number): HTMLCanvasElement { return this.windows.get(id); }
    public getGPUContext(id: number): GPUCanvasContext { return this.contexts.get(id); }
    public displayFormat(): GPUTextureFormat { return navigator.gpu.getPreferredCanvasFormat(); }

    public async loadVolume(): Promise<void> {
        console.log('CONTEXT: Loading Volume...');
        let volumes = await (await fetch('http://localhost:8080/volumes')).json();
        this.volume = volumes[0];
        this.volume.data = await (await fetch('http://localhost:8080/volume/' + this.volume.filename)).arrayBuffer();
        //for (let i = 0; i < volumes.length; i++) console.log(volumes[i]);
    }

    public async loadTransferFunction(): Promise<void> {
        console.log('CONTEXT: Loading Transfer Function...');
        let transferFunctions = await (await fetch('http://localhost:8080/transfer_functions')).json();
        this.transferFunction = transferFunctions[0];
        this.transferFunction.data = await (await fetch('http://localhost:8080/transfer_function/' + this.transferFunction.filename)).arrayBuffer();
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
            this.device = await this.adapter.requestDevice();
            this.queue = this.device.queue;
        }
        catch(error) {
            console.error(error);
            console.log('CONTEXT: WebGPU Not Supported.');
            return false;
        }
        console.log('CONTEXT: Initialised WebGPU.');
        this.transferFunction.size = [this.device.limits.maxTextureDimension1D, this.transferFunction.noColours / this.device.limits.maxTextureDimension1D];
        return true;
    }
}