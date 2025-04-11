import { Engine } from './engine';
import { Camera } from './camera';
import { Controller } from './controller';
import { RendererGUI } from './gui';

export abstract class Renderer {
    protected engine: Engine;
    protected camera: Camera;
    protected controller: Controller;
    protected gui: RendererGUI;

    protected renderID: number;

    protected uniformBuffer: GPUBuffer;
    protected volumeTexture: GPUTexture;
    protected sampler: GPUSampler;

    protected bindGroupEntries: GPUBindGroupEntry[];
    protected bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];

    protected bindGroupLayout: GPUBindGroupLayout;
    protected bindGroup: GPUBindGroup;
    protected pipeline: GPURenderPipeline;

    protected commandEncoder: GPUCommandEncoder;
    protected renderPassDescriptor: GPURenderPassDescriptor;

    protected _shaderCode: string;

    constructor(engine: Engine, renderID?: number) {
        this.renderID = renderID ?? Date.now();
        this.engine = engine;
        const volume = this.engine.volume;
        this.camera = new Camera(volume.bounds, volume.scale);
        this.controller = new Controller(this.engine.newWindow(this.renderID), this.camera);

        this.bindGroupEntries = [];
        this.bindGroupLayoutEntries = [];
    }

    public get id(): number { return this.renderID; }
    public get shaderCode(): string { return this._shaderCode; }
    protected abstract get uniformData(): Float32Array;

    public start(): void {
        this.initPipelineLayouts();
        this.initPipelines();
        this.initBuffers();
        this.initResources();
        this.initBindGroup();
    }

    protected initPipelineLayouts(): void {
        this.bindGroupLayoutEntries.push({ 
            binding: 0, 
            visibility: GPUShaderStage.FRAGMENT, 
            buffer: { type: 'uniform' } 
        });
        this.bindGroupLayoutEntries.push({ 
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT, 
            texture: { sampleType: 'float', viewDimension: '3d' } 
        });
        this.bindGroupLayoutEntries.push({ 
            binding: 2, 
            visibility: GPUShaderStage.FRAGMENT, 
            sampler: { type: 'filtering' } 
        });

        this.bindGroupLayout = this.engine.device.createBindGroupLayout({
            entries: this.bindGroupLayoutEntries
        });
    }

    private initPipelines(): void {
        const shaderModule = this.engine.device.createShaderModule({ code: this.shaderCode });

        this.pipeline = this.engine.device.createRenderPipeline({
            layout: this.engine.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vert_main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'frag_main',
                targets: [{ format: this.engine.displayFormat }]
            }
        });
    }

    private initBuffers(): void {
        // Create uniform buffer
        this.uniformBuffer = this.engine.device.createBuffer({
            size: this.uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    protected initResources(): void {
        this.sampler = this.engine.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        const volume = this.engine.volume;
        const bytesPerRow = volume.size[0] * volume.bytesPerVoxel;

        // Create 3D texture for volume data
        this.volumeTexture = this.engine.device.createTexture({
            size: volume.size,
            format: 'rg8unorm', // 16-bit - red(low bits), green(high bits)
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '3d'
        });

        // Upload volume data to texture
        const imageDataLayout = {
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: volume.size[1]
        };

        this.engine.queue.writeTexture(
            { texture: this.volumeTexture },
            volume.data,
            imageDataLayout,
            volume.size
        );

        // Setup render pass descriptor
        this.renderPassDescriptor = {
            colorAttachments: [{
                view: undefined, // set in render loop
                clearValue: [0.0, 0.0, 0.0, 1.0],
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
    }

    protected initBindGroup(): void {
        this.bindGroupEntries = [];
        this.bindGroupEntries.push({ binding: 0, resource: { buffer: this.uniformBuffer } });
        this.bindGroupEntries.push({ binding: 1, resource: this.volumeTexture.createView() });
        this.bindGroupEntries.push({ binding: 2, resource: this.sampler });

        this.bindGroup = this.engine.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: this.bindGroupEntries
        });
    }

    public render(): void {
        this.commandEncoder = this.engine.device.createCommandEncoder();
        this.renderPassDescriptor.colorAttachments[0].view = this.engine.context(this.renderID).getCurrentTexture().createView();
        
        // Execute render pass
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        this.engine.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.draw(3);
        passEncoder.end();
        
        this.engine.queue.submit([this.commandEncoder.finish()]);
    }

    public resize(size: [number, number]): void {
        this.camera.recentre(size);
        this.engine.resizeWindow(this.renderID, size);
    }

    public reset(): void {
        this.camera = new Camera(this.engine.volume.bounds, this.engine.volume.scale);
        this.controller = new Controller(this.engine.window(this.renderID), this.camera);
        
        this.bindGroupEntries = [];
        this.bindGroupLayoutEntries = [];
        
        this.initPipelineLayouts();
        this.initPipelines();
        this.initBuffers();
        this.initResources();
        this.initBindGroup();
    }
}