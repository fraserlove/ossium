import { Volume } from './volume';
import { TransferFunction } from './transferFunction';
import { Context } from './context';
import { RendererManager } from './manager';

async function main(): Promise<void> {

    const volume = await new Volume();
    const transferFunction = await new TransferFunction();
    const context = new Context(volume, transferFunction);
    const manager = new RendererManager(context);

    await context.initWebGPU();
    
    const run = () => {
        manager.render();
        requestAnimationFrame(run);
    }
    requestAnimationFrame(run);
}

main();
