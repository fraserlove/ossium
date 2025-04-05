import { GUI } from 'lil-gui';
import { RendererManager } from './manager';

export class GlobalSettings {
    protected gui: GUI;

    constructor(manager: RendererManager) {
        this.gui = new GUI({ title: 'Settings', width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui-global';
        document.body.appendChild(this.gui.domElement);

        // Add volume loading control
        const volumeFolder = this.gui.addFolder('Volume');
        const volumeInput = document.createElement('input');
        volumeInput.type = 'file';
        volumeInput.multiple = true;
        volumeInput.accept = '.dcm';
        volumeInput.style.display = 'none';
        document.body.appendChild(volumeInput);

        volumeFolder.add({
            loadDICOM: () => volumeInput.click()
        }, 'loadDICOM').name('Load DICOM Files');

        volumeInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                await manager.getContext().loadVolume(Array.from(files));
                // Reload all renderers
                manager.reloadAllRenderers();
            }
        };

        // Add transfer function loading control
        const tfFolder = this.gui.addFolder('Transfer Function');
        const tfInput = document.createElement('input');
        tfInput.type = 'file';
        tfInput.accept = '.tf';
        tfInput.style.display = 'none';
        document.body.appendChild(tfInput);

        tfFolder.add({
            loadTF: () => tfInput.click()
        }, 'loadTF').name('Load Transfer Function');

        tfInput.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                await manager.getContext().loadTransferFunction(files[0]);
                // Reload all renderers
                manager.reloadAllRenderers();
            }
        };

        // Add renderer controls
        const rendererFolder = this.gui.addFolder('Add Renderer');
        rendererFolder.add(manager, 'addMPR').name('Add MPR');
        rendererFolder.add(manager, 'addSVR').name('Add SVR');
    }
}

export class RendererSettings {
    protected gui: GUI;
    protected renderID: number;
    protected manager: RendererManager;

    constructor(renderID: number, manager: RendererManager) {
        this.renderID = renderID;
        this.manager = manager;
        this.gui = new GUI({ title: 'Renderer', width: 250, autoPlace: false });
        this.gui.domElement.id = 'gui';

        const volume = manager.getContext().getVolume();
        const volumeController = this.gui.add({ volume: volume.filename }, 'volume', manager.getContext().getVolumeIDs());
        volumeController.name('Volume');
        volumeController.disable(); // Disable selection since we're using file loading

        volumeController.onChange(async volumeID => {
            await manager.getContext().loadVolume(volumeID);
            manager.reloadRenderer(this.renderID);
        });

        manager.getContext().getContainer(this.renderID).appendChild(this.gui.domElement);
    }

    public getSettings(): Float32Array { 
        return new Float32Array(1); 
    }
}

export class SettingsMPR extends RendererSettings {
    private wWidth: number = 1000.0/65535.0;
    private wLevel: number = 0.498;

    constructor(renderID: number, manager: RendererManager) {
        super(renderID, manager);
        this.gui.title('MPR Settings');
        
        this.gui.add(this, 'wWidth', 0, 0.05).name('Window Width');
        this.gui.add(this, 'wLevel', 0.48, 0.52, 0.0001).name('Window Level');
        this.gui.add({destroyRenderer: manager.destroyRenderer.bind(manager, this.renderID)}, 'destroyRenderer').name('Delete');
    }

    public getSettings(): Float32Array { 
        return new Float32Array([this.wWidth, this.wLevel]); 
    }
}

export class SettingsSVR extends RendererSettings {
    private shininess: number = 50;
    private brightness: number = 1;
    private lightColour: number[] = [1, 1, 1];
    private includeSpecular: boolean = true;
    private ambient: number = 0.1;

    constructor(renderID: number, manager: RendererManager) {
        super(renderID, manager);
        this.gui.title('SVR Settings');

        let transferFunctionController = this.gui.add(manager.getContext().getTransferFunction(), 'filename', manager.getContext().getTransferFunctionIDs())
        transferFunctionController.name('Transfer Function');

        transferFunctionController.onChange(async transferFunctionID => {
            await manager.getContext().loadTransferFunction(transferFunctionID);
            manager.reloadRenderer(this.renderID);
        });

        this.gui.add(this, 'shininess', 0, 100).name('Shininess');
        this.gui.add(this, 'brightness', 0, 2).name('Brightness');
        this.gui.add(this, 'ambient', 0, 1).name('Ambient Light');
        this.gui.addColor(this, 'lightColour').name('Light Colour');
        this.gui.add(this, 'includeSpecular').name('Include Specular');
        this.gui.add({destroyRenderer: manager.destroyRenderer.bind(manager, this.renderID)}, 'destroyRenderer').name('Delete');
    }

    public getColour(): number[] {
        return this.includeSpecular ? this.lightColour : [0, 0, 0];
    }

    public getSettings(): Float32Array { 
        return new Float32Array([this.brightness, this.shininess, this.ambient]); 
    }
}