import { Context } from './context';
import { Camera } from './camera';
import { Controller } from './controller';
import { RendererManager } from './manager';
import { RendererSettings } from './gui';

const vertices = {
    vertexSize: 4 * 2, // Byte size of one vertex
    positionOffset: 0,
    vertexCount: 6,

    coords: new Float32Array([
        // Position coordinates
        1.0,  1.0,
        1.0, -1.0,
       -1.0, -1.0,
        1.0,  1.0,
       -1.0, -1.0,
       -1.0,  1.0,
    ])
}

export class Renderer {
    protected context: Context;
    protected camera: Camera;
    protected controller: Controller;
    protected settings: RendererSettings;

    protected renderID: number;

    protected shaderType: any;

    protected uniformBuffer: GPUBuffer;
    private vertexBuffer: GPUBuffer;
    protected volumeTexture: GPUTexture;
    protected sampler: GPUSampler;

    protected bindGroupEntries: GPUBindGroupEntry[];
    protected bindGroupLayoutEntries: GPUBindGroupLayoutEntry[];

    protected bindGroupLayout: GPUBindGroupLayout;
    protected bindGroup: GPUBindGroup;
    private pipeline: GPURenderPipeline;

    private commandEncoder: GPUCommandEncoder;
    private renderPassDescriptor: GPURenderPassDescriptor;

    constructor(manager: RendererManager, renderID?: number) {
        if (renderID != undefined) this.renderID = renderID;
        else this.renderID = (new Date()).getTime(); // Key in hashmap is time in milliseconds when created
        this.context = manager.getContext();
        this.camera = new Camera(this.context.getVolume());
        this.controller = new Controller(this.context.newWindow(this.renderID), this.camera);

        this.bindGroupEntries = [];
        this.bindGroupLayoutEntries = [];
    }

    public start(): void {
        console.log('RENDERER: Creating Pipelines...');
        this.initPipelineLayouts();
        this.initPipelines();
        console.log('RENDERER: Initialising Resources...');
        this.initBuffers();
        this.initResources();
        this.initBindGroup();
        console.log('RENDERER: Rendering...');
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

        this.pipeline = this.context.getDevice().createRenderPipeline({
            layout: this.context.getDevice().createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.context.getDevice().createShaderModule({ code: this.shaderType }),
                entryPoint: 'vert_main',
                buffers: [
                        {
                        arrayStride: vertices.vertexSize,
                        attributes: [
                            {
                                // Position
                                shaderLocation: 0,
                                offset: vertices.positionOffset,
                                format: 'float32x2',
                            }
                        ]
                    } as GPUVertexBufferLayout
                ]
            },
            fragment: {
                module: this.context.getDevice().createShaderModule({ code: this.shaderType }),
                entryPoint: 'frag_main',
                targets: [{ format: this.context.displayFormat() }]
            }
        });
    }

    private initBuffers(): void {

        this.uniformBuffer = this.context.getDevice().createBuffer({
            size: this.getUniformData().byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.vertexBuffer = this.context.getDevice().createBuffer({
            size: vertices.coords.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices.coords);
        this.vertexBuffer.unmap();
    }

    protected initResources(): void {
        this.sampler = this.context.getDevice().createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        const volume = this.context.getVolume();

        this.volumeTexture = this.context.getDevice().createTexture({
            size: volume.size,
            format: volume.textureFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '3d'
        });

        const imageDataLayout = {
            offset: 0,
            bytesPerRow: volume.bytesPerLine,
            rowsPerImage: volume.size[1]
        };

        this.context.getQueue().writeTexture(
            { texture: this.volumeTexture },
            volume.data,
            imageDataLayout,
            volume.size
        );

        this.renderPassDescriptor = {
            colorAttachments: [{
                view: undefined, // set in render loop
                clearValue: [0.0, 0.0, 0.0, 1.0],
                loadOp: 'clear' as GPULoadOp,
                storeOp: 'store' as GPUStoreOp
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
        this.renderPassDescriptor.colorAttachments[0].view = this.context.getGPUContext(this.renderID).getCurrentTexture().createView();
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        this.context.getQueue().writeBuffer(this.uniformBuffer, 0, this.getUniformData());
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(vertices.vertexCount);
        passEncoder.end();
    }

    protected getUniformData(): Float32Array {
        return this.settings.getSettings();
    }

    public render(): void {
        this.commandEncoder = this.context.getDevice().createCommandEncoder();
        this.executePipeline();
        this.context.getQueue().submit([this.commandEncoder.finish()]);
    }

    public resize(size): void {
        this.camera.resize(size);
        this.context.resizeWindow(this.renderID, size);
    }

    public getID(): number { return this.renderID; }
}