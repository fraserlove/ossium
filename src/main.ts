import { Context } from './context';
import { RendererManager } from './manager';

async function main(): Promise<void> {

    const context = new Context();
    const manager = new RendererManager(context);

    await context.initWebGPU();
    
    const run = () => {
        manager.render();
        requestAnimationFrame(run);
    }
    requestAnimationFrame(run);
}

main();
