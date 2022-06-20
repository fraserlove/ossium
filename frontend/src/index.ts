import { Volume } from './volume';
import { VolumeRenderer } from './renderer';

const windowWidth = 512;
const windowHeight = 512;

async function main() {

    const volume = await new Volume();
    const canvas = document.createElement('canvas');
    canvas.width = windowWidth;
    canvas.height = windowHeight;
    document.body.appendChild(canvas);

    const volumeRenderer = new VolumeRenderer(volume, canvas);
    volumeRenderer.start();
}

main()
