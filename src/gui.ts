import { GUI } from 'lil-gui';
import { RendererManager } from './manager';

export class GlobalGUI {
    protected gui: GUI;

    constructor(manager: RendererManager) {
        this.gui = new GUI({ title: 'Settings', width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui-global';
        document.body.appendChild(this.gui.domElement);

        this.globalGUI(manager);
    }

    private globalGUI(manager: RendererManager): void {
        const volumeInput = this.createFileInput('.dcm', true, true);
        
        this.gui.add({ loadDICOM: () => volumeInput.click() }, 'loadDICOM').name('Load Volume');

        volumeInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files?.length) return;
            
            const path = files[0].webkitRelativePath;
            const folderName = path.split('/')[0];
            
            await manager.getContext().loadVolume(Array.from(files), folderName);
            manager.reloadAllRenderers();
        };
        const tfInput = this.createFileInput('.tf', false, false);
        
        this.gui.add({ loadTF: () => tfInput.click() }, 'loadTF').name('Load Transfer Function');

        tfInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files?.length) return;
            
            await manager.getContext().loadTransferFunction(files[0]);
            manager.reloadAllRenderers();
        };

        this.gui.add(manager, 'addMPR').name('Add MPR');
        this.gui.add(manager, 'addSVR').name('Add SVR');
    }

    /**
     * Creates a file input element
     * @param accept The file types to accept
     * @param multiple Whether to allow multiple files
     * @param directory Whether to allow directory selection
     * @returns The created file input element
     */
    private createFileInput(accept: string, multiple: boolean, directory: boolean): HTMLInputElement {
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

export class RendererGUI {
    protected gui: GUI;
    protected renderID: number;
    protected manager: RendererManager;

    constructor(renderID: number, manager: RendererManager) {
        this.renderID = renderID;
        this.manager = manager;
        this.gui = new GUI({ title: 'Renderer', width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui';

        manager.getContext().getContainer(this.renderID).appendChild(this.gui.domElement);
    }

    public getSettings(): Float32Array { 
        return new Float32Array(1); 
    }
}

export class MPRGUI extends RendererGUI {
    private windowWidth: number = 0.018;
    private windowLevel: number = 0.498;

    constructor(renderID: number, manager: RendererManager) {
        super(renderID, manager);
        this.gui.title('MPR Settings');
        
        this.gui.add(this, 'windowWidth', 0, 0.05, 0.0001).name('Window Width');
        this.gui.add(this, 'windowLevel', 0.48, 0.52, 0.0001).name('Window Level');
        this.gui.add({destroyRenderer: () => manager.destroyRenderer(this.renderID)}, 'destroyRenderer').name('Delete');
    }

    public getSettings(): Float32Array { 
        return new Float32Array([this.windowWidth, this.windowLevel]); 
    }
}

export class SVRGUI extends RendererGUI {
    private shininess: number = 50;
    private brightness: number = 1;
    private lightColour: number[] = [1, 1, 1];
    private includeSpecular: boolean = true;
    private ambient: number = 0.3;

    constructor(renderID: number, manager: RendererManager) {
        super(renderID, manager);
        this.gui.title('SVR Settings');

        this.gui.add(this, 'shininess', 0, 100).name('Shininess');
        this.gui.add(this, 'brightness', 0, 2).name('Brightness');
        this.gui.add(this, 'ambient', 0, 1).name('Ambient Light');
        this.gui.addColor(this, 'lightColour').name('Light Colour');
        this.gui.add(this, 'includeSpecular').name('Include Specular');
        this.gui.add({ destroyRenderer: () => manager.destroyRenderer(this.renderID) }, 'destroyRenderer').name('Delete');
    }

    public getColour(): number[] {
        return this.includeSpecular ? this.lightColour : [0, 0, 0];
    }

    public getSettings(): Float32Array { 
        return new Float32Array([this.brightness, this.shininess, this.ambient]); 
    }
}