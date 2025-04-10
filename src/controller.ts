import { Camera } from './camera';

export class Controller {
    private display: HTMLCanvasElement;
    private camera: Camera;
    private activeButton: number | null = null;
    private updateLightSource: boolean = false;
    private initPos: [number, number] = [0, 0];

    // Sensitivity parameters
    private readonly zoomFactor: number = 1000;
    private readonly rotationFactor: number = 400;
    private readonly lightFactor: number = 400;
    private readonly panFactor: number = 1;

    /**
     * Creates a new controller for camera interaction
     * @param display Canvas element to attach events to
     * @param camera Camera to control
     */
    constructor(display: HTMLCanvasElement, camera: Camera) {
        this.display = display;
        this.camera = camera;

        // Disable context menu on right-click (default behaviour)
        this.display.oncontextmenu = (e) => e.preventDefault();

        this.display.addEventListener('wheel', this.mouseWheel.bind(this), { passive: false });
        this.display.addEventListener('mousedown', this.mouseDown.bind(this), false);
        this.display.addEventListener('mouseup', this.mouseUp.bind(this), false);
        this.display.addEventListener('mousemove', this.mouseMove.bind(this), false);

        document.addEventListener('keydown', this.keyDown.bind(this), false);
        document.addEventListener('keyup', this.keyUp.bind(this), false);
    }

    private mouseWheel(e: WheelEvent): void {
        e.preventDefault(); // Prevent page scrolling
        
        // Simplify to only handle zoom
        this.camera.zoom = e.deltaY / this.zoomFactor;
    }

    private mouseDown(e: MouseEvent): void {
        this.activeButton = e.button;
        this.initPos = [e.pageX, e.pageY];
        // Hide cursor when clicking
        this.display.style.cursor = 'none';
    }

    private mouseUp(e: MouseEvent): void {
        if (e.button === this.activeButton) {
            this.activeButton = null;
            // Restore cursor when releasing mouse button
            this.display.style.cursor = 'default';
        }
    }

    private mouseMove(e: MouseEvent): void {
        const dx = e.pageX - this.initPos[0];
        const dy = e.pageY - this.initPos[1];
        
        if (this.activeButton === 0) { // Left button
            // Update lighting if shift key is held
            if (this.updateLightSource) {
                this.camera.lighting = [dx / this.lightFactor, dy / this.lightFactor];
            } else {
                // Rotate view otherwise
                this.camera.rotation = [dx / this.rotationFactor, dy / this.rotationFactor];
            }
        } else if (this.activeButton === 2) { // Right button
            // Pan view
            this.camera.pan = [dx * this.panFactor, dy * this.panFactor];
        }
        
        this.initPos = [e.pageX, e.pageY];
    }

    private keyDown(e: KeyboardEvent): void { if (e.key === 'Shift') this.updateLightSource = true; }
    private keyUp(e: KeyboardEvent): void { if (e.key === 'Shift') this.updateLightSource = false; }
}