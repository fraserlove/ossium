import { Volume } from './volume';
import shader from '../shaders/shader.wgsl';
import mip from '../shaders/mip.wgsl';

type Settings = {
    width: number,
    level: number
};

export class VolumeRenderer {
    volume: Volume;
    settings: Settings;

    tileDim: number;
    blockDims: number[];
    noWorkgroups: number[];

    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;

    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    canvasFormat: GPUTextureFormat;

    renderUniformBuffer: GPUBuffer;
    computeUniformBuffer: GPUBuffer;
    verticesBuffer: GPUBuffer;
    mipTexture: GPUTexture;
    volumeTexture: GPUTexture;
    sampler: GPUSampler;

    renderBindGroupLayout: GPUBindGroupLayout;
    computeBindGroupLayout: GPUBindGroupLayout;
    renderBindGroup: GPUBindGroup;
    computeBindGroup: GPUBindGroup;
    renderPipeline: GPURenderPipeline;
    computePipeline: GPUComputePipeline;
    
    commandEncoder: GPUCommandEncoder;
    renderPassDescriptor: GPURenderPassDescriptor;

    renderUniformData: Float32Array;
    computeUniformData: Float32Array;

    constructor(volume, canvas, settings) {
        this.volume = volume;
        this.canvas = canvas;
        this.settings = settings;

        this.blockDims = [8, 8]; // Must be same as workgroup size in compute shader
        this.noWorkgroups = [Math.ceil(this.volume.width / this.blockDims[0]), Math.ceil(this.volume.height / this.blockDims[1])]

         this.computeUniformData = new Float32Array([
            // Transformation matrix
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ]);

        this.renderUniformData = new Float32Array([
            // Window width and window level parameters
            this.settings.width, this.settings.level
        ]);
    }

    public async start() {
        console.log('Initialising WebGPU...');
        if (await this.initWebGPU()) {
            console.log('Creating pipelines...');
            this.createPipelines();
            console.log('Initialising Resources...');
            this.initResources();
        }
        else {
            console.log('WebGPU support not detected.')
        }
    }

    private async initWebGPU(): Promise<boolean> {
        try {
            this.adapter = await navigator.gpu.requestAdapter();
            this.device = await this.adapter.requestDevice();
            this.queue = this.device.queue;

            this.context = this.canvas.getContext('webgpu');
            this.canvasFormat = navigator.gpu.getPreferredCanvasFormat(),
            this.context.configure({
                device: this.device,
                format: this.canvasFormat,
                alphaMode: 'premultiplied'
            });
        }
        catch(error) {
            console.error(error);
            return false;
        }
        return true;
    }

    private createPipelines() {
        this.renderBindGroupLayout = this.device.createBindGroupLayout({
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
                } as GPUBindGroupLayoutEntry,
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                } as GPUBindGroupLayoutEntry
            ]
        });

        this.computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'uniform' }
                } as GPUBindGroupLayoutEntry,
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: { sampleType: 'float', viewDimension: '3d' }
                } as GPUBindGroupLayoutEntry,
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { format: 'rgba16float', access: 'write-only', viewDimension: '2d'}
                } as GPUBindGroupLayoutEntry,
            ]
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.renderBindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: 'vert_main',
                buffers: [
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: 'frag_main',
                targets: [{ format: this.canvasFormat }]
            }
        });

        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.computeBindGroupLayout]
            }),
            compute: {
                module: this.device.createShaderModule({ code: mip }),
                entryPoint: 'main'
            }
        });
    }

    private initResources() {
        this.renderUniformBuffer = this.device.createBuffer({
            size: this.renderUniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.computeUniformBuffer = this.device.createBuffer({
            size: this.computeUniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        this.volumeTexture = this.device.createTexture({
            size: [this.volume.width, this.volume.height, this.volume.depth],
            // rg8unorm or r8unorm - red(low bits), green(high bits)
            format: this.volume.textureFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: '3d'
        });

        this.mipTexture = this.device.createTexture({
            size: [this.volume.width, this.volume.height],
            format: 'rgba16float',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });

        const imageDataLayout = {
            offset: 0,
            bytesPerRow: this.volume.bytesPerLine,
            rowsPerImage: this.volume.height
        };

        this.queue.writeTexture({ texture: this.volumeTexture }, this.volume.data, imageDataLayout, this.volume.size());
        this.queue.writeBuffer(this.renderUniformBuffer, 0, this.renderUniformData);
        this.queue.writeBuffer(this.computeUniformBuffer, 0, this.computeUniformData);
       
        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.renderUniformBuffer } },
                { binding: 1, resource: this.mipTexture.createView() },
                { binding: 2, resource: this.sampler }
            ]
        });

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.computeUniformBuffer } },
                { binding: 1, resource: this.volumeTexture.createView() },
                { binding: 2, resource: this.mipTexture.createView() }
            ]
        })

        this.renderPassDescriptor = {
            colorAttachments: [{
                view: undefined, // set in render loop
                clearValue: [0.0, 0.0, 0.0, 1.0],
                loadOp: 'clear' as GPULoadOp,
                storeOp: 'store' as GPUStoreOp
            }]
        }
    }

    public updateSettings(settings) {
        this.settings = settings;
        this.renderUniformData = new Float32Array([this.settings.width, this.settings.level]);
        this.queue.writeBuffer(this.renderUniformBuffer, 0, this.renderUniformData);
    }

    private executeComputePipeline() {
        const passEncoder = this.commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        passEncoder.dispatchWorkgroups(this.noWorkgroups[0], this.noWorkgroups[1]);
        passEncoder.end();
    }

    private executeRenderPipeline() {
        this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
        const passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, this.renderBindGroup);
        passEncoder.draw(6);
        passEncoder.end();
    }

    public render() {
        console.log('Executing Pipelines...');

        this.commandEncoder = this.device.createCommandEncoder();
        this.executeComputePipeline();
        this.executeRenderPipeline();
        this.queue.submit([this.commandEncoder.finish()]);
    }

}