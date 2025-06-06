import { Camera } from './camera';

export class Controller {
    private camera: Camera;
    private display: HTMLCanvasElement;
    private activeButton: number | null = null;
    private activeKey: string | null = null;

    // Sensitivity parameters
    private readonly ZOOM_FACTOR: number = 0.0025;
    private readonly ROTATION_FACTOR: number = 0.0025;
    private readonly LIGHT_FACTOR: number = 0.0025;
    private readonly PAN_FACTOR: number = 1;

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
        this.camera.zoom = e.deltaY * this.ZOOM_FACTOR;
    }

    private mouseDown(e: MouseEvent): void {
        this.display.requestPointerLock() // Hide cursor
        this.activeButton = e.button;
    }

    private mouseUp(e: MouseEvent): void {
        document.exitPointerLock(); // Restore cursor
        this.activeButton = null;
    }

    private mouseMove(e: MouseEvent): void {
        const dx = e.movementX;
        const dy = e.movementY;
        
        switch (this.activeButton) {
            case 0: // Left button
                switch (this.activeKey) {
                    case 'Control':
                        this.camera.lighting = [dx * this.LIGHT_FACTOR, dy * this.LIGHT_FACTOR];
                        break;
                    default:
                        this.camera.rotation = [dx * this.ROTATION_FACTOR, dy * this.ROTATION_FACTOR];
                        break;
                }
                break;
            case 2: // Right button
                this.camera.pan = [dx * this.PAN_FACTOR, dy * this.PAN_FACTOR];
                break;
        }
    }

    private keyDown(e: KeyboardEvent): void { this.activeKey = e.key; }
    private keyUp(e: KeyboardEvent): void { this.activeKey = null; }
}