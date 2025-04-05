import { Volume } from './volume';
import { TransferFunction } from './transfer_function';

export class Context {
    private volume: Volume;
    private transferFunction: TransferFunction;
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
        
        // Initialize with empty volume and transfer function
        this.volume = new Volume();
        this.transferFunction = new TransferFunction();
    }

    public getVolume(): Volume { return this.volume; }
    public getTransferFunction(): TransferFunction { return this.transferFunction; }
    public getVolumeIDs(): string[] { return this.volumeIDs; }
    public getTransferFunctionIDs(): string[] { return this.transferFunctionIDs; }
    public getDevice(): GPUDevice { return this.device; }
    public getQueue(): GPUQueue { return this.queue; }
    public getContainer(id: number): HTMLDivElement { return this.containers.get(id); }
    public getWindow(id: number): HTMLCanvasElement { return this.windows.get(id); }
    public getGPUContext(id: number): GPUCanvasContext { return this.contexts.get(id); }
    public displayFormat(): GPUTextureFormat { return navigator.gpu.getPreferredCanvasFormat(); }

    public async loadVolume(files: File[]): Promise<void> {
        try {
            const volume = new Volume(files[0].name);
            await volume.load(files);
            this.volume = volume;
            if (!this.volumeIDs.includes(volume.filename)) {
                this.volumeIDs.push(volume.filename);
            }
            console.log('CONTEXT: Loaded Volume ' + this.volume.filename);
        } catch (error) {
            console.error('Failed to load volume:', error);
        }
    }

    public async loadTransferFunction(file: File): Promise<void> {
        try {
            const tf = new TransferFunction(file.name);
            await tf.load(file);
            this.transferFunction = tf;
            if (!this.transferFunctionIDs.includes(tf.filename)) {
                this.transferFunctionIDs.push(tf.filename);
            }
            console.log('CONTEXT: Loaded Transfer Function ' + this.transferFunction.filename);
        } catch (error) {
            console.error('Failed to load transfer function:', error);
        }
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
        return true;
    }
}