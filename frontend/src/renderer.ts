import { Context } from './context';
import { Camera } from './camera';
import { imagePlane } from './vertices';
import { Controller } from './controller';
import { RendererManager } from './manager';
import { RendererSettings } from './settings';

export class Renderer {
    protected context: Context;
    protected camera: Camera;
    protected controller: Controller;
    protected settings: RendererSettings;

    protected renderID: number;
    private size: number[];

    protected computeShaderType: any;
    protected renderShaderType: any;

    protected renderUniformBuffer: GPUBuffer;
    protected computeUniformBuffer: GPUBuffer;
    private vertexBuffer: GPUBuffer;
    private computeTexture: GPUTexture;
    protected volumeTexture: GPUTexture;
    protected sampler: GPUSampler;

    protected computeBindGroupEntries: GPUBindGroupEntry[];
    protected computeBindGroupLayoutEntries: GPUBindGroupLayoutEntry[];

    protected renderBindGroupLayout: GPUBindGroupLayout;
    protected computeBindGroupLayout: GPUBindGroupLayout;
    protected renderBindGroup: GPUBindGroup;
    protected computeBindGroup: GPUBindGroup;
    private renderPipeline: GPURenderPipeline;
    private computePipeline: GPURenderPipeline;

    private commandEncoder: GPUCommandEncoder;
    private renderPassDescriptor: GPURenderPassDescriptor;

    constructor(manager: RendererManager) {
        this.renderID = (new Date()).getTime(); // Key in hashmap is time in milliseconds when created
        this.context = manager.getContext();
        this.camera = new Camera(this.context.getVolume());
        this.controller = new Controller(this.context.newWindow(this.renderID), this.camera);

        this.computeBindGroupEntries = [];
        this.computeBindGroupLayoutEntries = [];
    }

    public start(): void {
        console.log('RENDERER: Creating Pipelines...');
        this.initPipelineLayouts();
        this.initPipelines();
        console.log('RENDERER: Initialising Resources...');
        this.initBuffers();
        this.initResources();
        this.initComputeGroup();
        this.initRenderGroup();
        console.log('RENDERER: Rendering...');
    }

    protected initPipelineLayouts(): void {
        this.renderBindGroupLayout = this.context.getDevice().createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                } as GPUBindGroupLayoutEntry,
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float', viewDimension: '2d' }
                } as GPUBindGroupLayoutEntry
            ]
        });

        this.computeBindGroupLayoutEntries.push({ 
            binding: 0, 
            visibility: GPUShaderStage.FRAGMENT, 
            buffer: { type: 'uniform' } 
        });
        this.computeBindGroupLayoutEntries.push({ 
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT, 
            texture: { sampleType: 'float', viewDimension: '3d' } 
        });
        this.computeBindGroupLayoutEntries.push({ 
            binding: 2, 
            visibility: GPUShaderStage.FRAGMENT, 
            sampler: { type: 'filtering' } 
        });

        this.computeBindGroupLayout = this.context.getDevice().createBindGroupLayout({
            entries: this.computeBindGroupLayoutEntries
        });
    }

    private initPipelines(): void {
        this.renderPipeline = this.context.getDevice().createRenderPipeline({
            layout: this.context.getDevice().createPipelineLayout({
                bindGroupLayouts: [this.renderBindGroupLayout]
            }),
            vertex: {
                module: this.context.getDevice().createShaderModule({ code: this.renderShaderType }),
                entryPoint: 'vert_main',
                buffers: [
                        {
                        arrayStride: imagePlane.vertexSize,
                        attributes: [
                            {
                                // Position
                                shaderLocation: 0,
                                offset: imagePlane.positionOffset,
                                format: 'float32x2',
                            }
                        ]
                    } as GPUVertexBufferLayout
                ]
            },
            fragment: {
                module: this.context.getDevice().createShaderModule({ code: this.renderShaderType }),
                entryPoint: 'frag_main',
                targets: [{ format: this.context.displayFormat() }]
            }
        });

        this.computePipeline = this.context.getDevice().createRenderPipeline({
            layout: this.context.getDevice().createPipelineLayout({
                bindGroupLayouts: [this.computeBindGroupLayout]
            }),
            vertex: {
                module: this.context.getDevice().createShaderModule({ code: this.computeShaderType }),
                entryPoint: 'vert_main',
                buffers: [
                        {
                        arrayStride: imagePlane.vertexSize,
                        attributes: [
                            {
                                // Position
                                shaderLocation: 0,
                                offset: imagePlane.positionOffset,
                                format: 'float32x2',
                            }
                        ]
                    } as GPUVertexBufferLayout
                ]
            },
            fragment: {
                module: this.context.getDevice().createShaderModule({ code: this.computeShaderType }),
                entryPoint: 'frag_main',
                targets: [{ format: 'rgba16float' }]
            }
        });
    }

    private initBuffers(): void {
        this.renderUniformBuffer = this.context.getDevice().createBuffer({
            size: this.getRenderUniformData().byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.computeUniformBuffer = this.context.getDevice().createBuffer({
            size: this.getComputeUniformData().byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.vertexBuffer = this.context.getDevice().createBuffer({
            size: imagePlane.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(imagePlane.vertices);
        this.vertexBuffer.unmap();
    }

    protected initResources(): void {
        this.sampler = this.context.getDevice().createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        this.computeTexture = this.context.getDevice().createTexture({
            size: this.size,
            format: 'rgba16float',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.volumeTexture = this.context.getDevice().createTexture({
            size: this.context.getVolume().size,
            // rg8unorm or r8unorm - red(low bits), green(high bits)
            format: this.context.getVolume().textureFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '3d'
        });

        const imageDataLayout = {
            offset: 0,
            bytesPerRow: this.context.getVolume().bytesPerLine,
            rowsPerImage: this.context.getVolume().size[1]
        };

        this.context.getQueue().writeTexture({ texture: this.volumeTexture }, this.context.getVolume().data, imageDataLayout, this.context.getVolume().size);

        this.renderPassDescriptor = {
            colorAttachments: [{
                view: undefined, // set in render loop
                clearValue: [0.0, 0.0, 0.0, 1.0],
                loadOp: 'clear' as GPULoadOp,
                storeOp: 'store' as GPUStoreOp
            }]
        };
    }

    protected initComputeGroup(): void {
        this.computeBindGroupEntries.push({ binding: 0, resource: { buffer: this.computeUniformBuffer } });
        this.computeBindGroupEntries.push({ binding: 1, resource: this.volumeTexture.createView() });
        this.computeBindGroupEntries.push({ binding: 2, resource: this.sampler });

        this.computeBindGroup = this.context.getDevice().createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: this.computeBindGroupEntries
        });
    }

    protected initRenderGroup(): void {
        this.renderBindGroup = this.context.getDevice().createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.renderUniformBuffer } },
                { binding: 1, resource: this.computeTexture.createView() },
            ]
        });
    }

    private executeComputePipeline(): void {
        this.renderPassDescriptor.colorAttachments[0].view = this.computeTexture.createView();
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.computePipeline);
        this.context.getQueue().writeBuffer(this.computeUniformBuffer, 0, this.getComputeUniformData());
        passEncoder.setBindGroup(0, this.computeBindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(imagePlane.vertexCount);
        passEncoder.end();
    }

    private executeRenderPipeline(): void {
        this.renderPassDescriptor.colorAttachments[0].view = this.context.getGPUContext(this.renderID).getCurrentTexture().createView();
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.renderPipeline);
        this.context.getQueue().writeBuffer(this.renderUniformBuffer, 0, this.getRenderUniformData());
        passEncoder.setBindGroup(0, this.renderBindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(imagePlane.vertexCount);
        passEncoder.end();
    }

    protected getRenderUniformData(): Float32Array {
        return this.settings.getRenderSettings();
    }

    protected getComputeUniformData(): Float32Array {
        return this.settings.getComputeSettings();
    }

    public render(): void {
        this.commandEncoder = this.context.getDevice().createCommandEncoder();
        this.executeComputePipeline();
        this.executeRenderPipeline();
        this.context.getQueue().submit([this.commandEncoder.finish()]);
    }

    public resize(size): void {
        this.size = size;
        this.camera.resize(size);
        this.context.resizeWindow(this.renderID, size);

        if (this.renderUniformBuffer != undefined) { // Needed so doesnt run when first setting up renderers
            this.computeTexture = this.context.getDevice().createTexture({
                size: size,
                format: 'rgba16float',
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
            }); 
            this.initRenderGroup();
        }
    }

    public getID(): number { return this.renderID; }
}