import { Engine } from './engine';

async function main(): Promise<void> {
    const engine = new Engine();
    await engine.initWebGPU();
    
    const run = () => {
        engine.render();
        requestAnimationFrame(run);
    }
    requestAnimationFrame(run);
}

main();
