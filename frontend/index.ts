import * as  _ from 'lodash';

async function processImage (array: Uint8Array, width: number, height: number) : Promise<Uint8Array> {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  return new Promise(resolve => {

    // INIT BUFFERS
    const sizeArray = new Int32Array([width, height]);
    const gpuWidthHeightBuffer = device.createBuffer({
      mappedAtCreation: true,
      size: sizeArray.byteLength,
      usage: GPUBufferUsage.STORAGE
    });
    new Int32Array(gpuWidthHeightBuffer.getMappedRange()).set(sizeArray);
    gpuWidthHeightBuffer.unmap();
    
    const gpuInputBuffer = device.createBuffer({
      mappedAtCreation: true,
      size: array.byteLength,
      usage: GPUBufferUsage.STORAGE
    });
    new Uint8Array(gpuInputBuffer.getMappedRange()).set(array);
    gpuInputBuffer.unmap();

    const gpuResultBuffer = device.createBuffer({
      size: array.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const gpuReadBuffer = device.createBuffer({
      size: array.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // BINDING GROUP LAYOUT
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage"
          }
        } as GPUBindGroupLayoutEntry,
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage"
          }
        } as GPUBindGroupLayoutEntry,
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "storage"
          }
        } as GPUBindGroupLayoutEntry
      ]
    });

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: gpuWidthHeightBuffer
          }
        },
        {
          binding: 1,
          resource: {
            buffer: gpuInputBuffer
          }
        },
        {
          binding: 2,
          resource: {
            buffer: gpuResultBuffer
          }
        }
      ]
    });

    // SHADER
    const shaderModule = device.createShaderModule({
      code: `
        struct Size {
          size: vec2<u32>
        };

        struct Image {
          rgba: array<u32>
        };

        @group(0) @binding(0) var<storage, read> widthHeight: Size;
        @group(0) @binding(1) var<storage, read> inputPixels: Image;
        @group(0) @binding(2) var<storage, write> outputPixels: Image;

        @stage(compute)
        @workgroup_size(1)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let index: u32 = global_id.x + global_id.y * widthHeight.size.x;
          outputPixels.rgba[index] = 4294967295u - inputPixels.rgba[index];
        }
      `
    });

    const computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      compute: {
        module: shaderModule,
        entryPoint: "main"
      }
    });

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(width, height);
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(gpuResultBuffer, 0, gpuReadBuffer, 0, array.byteLength);

    device.queue.submit([commandEncoder.finish()]);

    gpuReadBuffer.mapAsync(GPUMapMode.READ).then( () => {
      resolve(new Uint8Array(gpuReadBuffer.getMappedRange()));
    });
  });
}