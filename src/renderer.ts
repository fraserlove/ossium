import { Context } from './context';
import { Camera } from './camera';
import { Controller } from './controller';
import { RendererGUI } from './gui';
import { RendererManager } from './manager';

export abstract class Renderer {
    protected manager: RendererManager;
    protected context: Context;
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

    constructor(manager: RendererManager, renderID?: number) {
        this.renderID = renderID ?? Date.now();
        this.manager = manager;
        this.context = manager.getContext();
        this.camera = new Camera(this.context.getVolume());
        this.controller = new Controller(this.context.newWindow(this.renderID), this.camera);

        this.bindGroupEntries = [];
        this.bindGroupLayoutEntries = [];
    }

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

        this.bindGroupLayout = this.context.getDevice().createBindGroupLayout({
            entries: this.bindGroupLayoutEntries
        });
    }

    private initPipelines(): void {
        const device = this.context.getDevice();
        const shaderCode = this.getShaderCode();
        const shaderModule = device.createShaderModule({ code: shaderCode });

        this.pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vert_main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'frag_main',
                targets: [{ format: this.context.displayFormat() }]
            }
        });
    }

    private initBuffers(): void {
        const device = this.context.getDevice();
        
        this.uniformBuffer = device.createBuffer({
            size: this.getUniformData().byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    protected initResources(): void {
        const device = this.context.getDevice();
        const volume = this.context.getVolume();
        
        this.sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        // Using 16-bit texture format - red(low bits), green(high bits)
        const textureFormat = 'rg8unorm';
        
        const bytesPerRow = volume.size[0] * volume.bytesPerVoxel;

        // Create 3D texture for volume data
        this.volumeTexture = device.createTexture({
            size: volume.size,
            format: textureFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '3d'
        });

        // Upload volume data to texture
        const imageDataLayout = {
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: volume.size[1]
        };

        this.context.getQueue().writeTexture(
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

        this.bindGroup = this.context.getDevice().createBindGroup({
            layout: this.bindGroupLayout,
            entries: this.bindGroupEntries
        });
    }

    private executePipeline(): void {
        this.renderPassDescriptor.colorAttachments[0].view = 
            this.context.getGPUContext(this.renderID).getCurrentTexture().createView();
        
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        
        this.context.getQueue().writeBuffer(this.uniformBuffer, 0, this.getUniformData());
        
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.draw(3);
        passEncoder.end();
    }

    protected abstract getUniformData(): Float32Array;

    public render(): void {
        this.commandEncoder = this.context.getDevice().createCommandEncoder();
        this.executePipeline();
        this.context.getQueue().submit([this.commandEncoder.finish()]);
    }

    public resize(size: number[]): void {
        this.camera.resize(size);
        this.context.resizeWindow(this.renderID, size);
    }

    public getID(): number { 
        return this.renderID; 
    }

    protected abstract getShaderCode(): string;

    public reset(): void {
        this.camera = new Camera(this.context.getVolume());
        this.controller = new Controller(this.context.getWindow(this.renderID), this.camera);
        
        this.bindGroupEntries = [];
        this.bindGroupLayoutEntries = [];
        
        this.initPipelineLayouts();
        this.initPipelines();
        this.initBuffers();
        this.initResources();
        this.initBindGroup();
    }
}