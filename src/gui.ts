import { GUI } from 'lil-gui';
import { Engine } from './engine';

export class GlobalGUI {
    protected gui: GUI;

    constructor(engine: Engine) {
        this.gui = new GUI({ title: 'Settings', width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui-global';
        document.body.appendChild(this.gui.domElement);

        this.setup(engine);
    }

    private setup(engine: Engine): void {
        // Volume loading
        const volumeInput = this.fileInput('.dcm', true, true);
        this.gui.add({ loadDICOM: () => volumeInput.click() }, 'loadDICOM').name('Load Volume');
        volumeInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files?.length) return;
            
            const folderName = files[0].webkitRelativePath.split('/')[0];
            await engine.loadVolume(Array.from(files), folderName);
            engine.reloadAllRenderers();
        };

        // Transfer function loading
        const tfInput = this.fileInput('.tf', false, false);
        this.gui.add({ loadTF: () => tfInput.click() }, 'loadTF').name('Load Transfer Function');
        tfInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files?.length) return;
            
            await engine.loadTransferFunction(files[0]);
            engine.reloadAllRenderers();
        };

        this.gui.add({ addMPR: () => engine.addMPR() }, 'addMPR').name('Add MPR');
        this.gui.add({ addSVR: () => engine.addSVR() }, 'addSVR').name('Add SVR');
    }

    /**
     * Creates a file input element
     * @param accept The file types to accept
     * @param multiple Whether to allow multiple files
     * @param directory Whether to allow directory selection
     * @returns The created file input element
     */
    private fileInput(accept: string, multiple: boolean, directory: boolean): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        
        if (multiple) input.multiple = true;
        if (directory) input.webkitdirectory = true;
        
        document.body.appendChild(input);
        return input;
    }
}

export abstract class RendererGUI {
    protected gui: GUI;

    constructor(title: string, renderID: number, engine: Engine) {
        this.gui = new GUI({ title: title, width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui';
        engine.container(renderID).appendChild(this.gui.domElement);
    }

    public abstract get settings(): Float32Array;
}

export class MPRGUI extends RendererGUI {
    private windowWidth: number = 0.018;
    private windowLevel: number = 0.498;

    constructor(renderID: number, engine: Engine) {
        super('MPR', renderID, engine);
        this.gui.add(this, 'windowWidth', 0, 0.05, 0.0001).name('Window Width');
        this.gui.add(this, 'windowLevel', 0.48, 0.52, 0.0001).name('Window Level');
        this.gui.add({ destroy: () => engine.destroyRenderer(renderID) }, 'destroy').name('Delete');
    }

    public get settings(): Float32Array { 
        return new Float32Array([this.windowWidth, this.windowLevel]); 
    }
}

export class SVRGUI extends RendererGUI {
    private diffuse: number = 1;
    private specular: number = 0.5;
    private ambient: number = 0.3;
    private lightColour: number[] = [1, 1, 1];

    constructor(renderID: number, engine: Engine) {
        super('SVR', renderID, engine);
        this.gui.add(this, 'diffuse', 0, 1).name('Diffuse');
        this.gui.add(this, 'specular', 0, 1).name('Specular');
        this.gui.add(this, 'ambient', 0, 1).name('Ambient');
        this.gui.addColor(this, 'lightColour').name('Light Colour');
        this.gui.add({ destroy: () => engine.destroyRenderer(renderID) }, 'destroy').name('Delete');
    }

    public get settings(): Float32Array {
        return new Float32Array([...this.lightColour, this.diffuse, this.specular, this.ambient]); 
    }
}