import { mat4, vec3 } from 'gl-matrix';
import { Volume } from './volume';

export class Camera {
    private viewDir: vec3;  // x-axis for camera (towards volume)
    private viewUp: vec3;   // y-axis for camera (upwards from top of camera)
    private viewSide: vec3; // z-axis for camera (parallel to image plane)

    private position: vec3; // Position in image space (pan/cine)
    private scale: vec3;    // Scale factors for x, y, z

    private camera: mat4;
    private view: mat4;

    private lightDir: vec3;

    private imageSize: number[];
    private volumeBounds: number[];
    private volumeDataScale: number;

    constructor(volume: Volume) {
        this.volumeBounds = volume.boundingBox;
        this.volumeDataScale = volume.boundingBox[2] / volume.size[2];

        this.viewDir = vec3.create();
        this.viewUp = vec3.create();
        this.viewSide = vec3.create();
        this.position = vec3.create();
        this.scale = vec3.create();
        this.camera = mat4.create();
        this.view = mat4.create();
        this.lightDir = vec3.create();

        // Set default values
        this.setLighting(1, 0);
        this.setScale(0.4);
        this.setPanCine(0, 0, this.volumeBounds[2] / 2);
        this.setViewDir(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 1));
    }

    /**
     * Calculates the view matrix based on current camera parameters
     */
    private calculateViewMatrix(): void {
        this.camera = mat4.create();

        const viewBasisMatrix: mat4 = mat4.fromValues(
            this.viewSide[0], this.viewUp[0], this.viewDir[0], 0,
            this.viewSide[1], this.viewUp[1], this.viewDir[1], 0,
            this.viewSide[2], this.viewUp[2], this.viewDir[2], 0,
            0, 0, 0, 1
        );
        
        // Scale z-axis according to volume-to-data ratio
        mat4.multiply(this.camera, mat4.fromScaling(mat4.create(), vec3.fromValues(1, 1, this.volumeDataScale)), this.camera);
        // Centre volume at origin
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.volumeCentre()), this.camera);
        // Apply rotation
        mat4.multiply(this.camera, viewBasisMatrix, this.camera);
        // Apply translation (pan/cine)
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.position), this.camera);
        // Apply scaling
        mat4.multiply(this.camera, mat4.fromScaling(mat4.create(), this.scale), this.camera);
        // Centre image in window
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.imageCentre()), this.camera);
        
        mat4.invert(this.view, this.camera);
    }

    /**
     * Returns the camera transformation matrix
     */
    public getCameraMatrix(): Float32Array { 
        this.calculateViewMatrix(); 
        return this.camera as Float32Array; 
    }
    
    /**
     * Returns the view matrix (inverse of camera matrix)
     */
    public getViewMatrix(): Float32Array { 
        this.calculateViewMatrix(); 
        return this.view as Float32Array; 
    }
    
    /**
     * Returns the light direction vector
     */
    public getLightDir(): Float32Array { 
        return this.lightDir as Float32Array; 
    }

    /**
     * Calculates the center point of the volume
     */
    private volumeCentre(): vec3 { 
        return vec3.fromValues(-this.volumeBounds[0] / 2, -this.volumeBounds[1] / 2, -this.volumeBounds[2] / 2); 
    }
    
    /**
     * Calculates the center point of the image
     */
    private imageCentre(): vec3 { 
        return vec3.fromValues(this.imageSize[0] / 2, this.imageSize[1] / 2, 0); 
    }

    /**
     * Sets the view direction and up vector, recalculating the side vector
     */
    private setViewDir(viewDir: vec3, viewUp: vec3): void {        
        // Calculate orthogonal vectors
        const viewSide: vec3 = vec3.create();
        vec3.cross(viewSide, viewDir, viewUp);
        vec3.normalize(viewSide, viewSide);
        
        // Recalculate up vector to ensure orthogonality
        vec3.cross(this.viewUp, viewDir, viewSide);
        vec3.normalize(this.viewUp, this.viewUp);
        
        // Set camera orientation vectors
        vec3.copy(this.viewDir, viewDir);
        vec3.copy(this.viewSide, viewSide);
    }

    /**
     * Sets the scale factor for the camera
     */
    private setScale(s: number): void {
        if (s > 0) {
            this.scale = vec3.fromValues(s, s, 1);
        }
    }

    /**
     * Sets the position in image space
     */
    private setPanCine(x: number, y: number, z: number): void {
        this.position = vec3.fromValues(x, y, z);
    }

    /**
     * Updates the position along the z-axis (cine)
     */
    public updateCine(dz: number): void {
        this.position[2] += dz;
    }

    /**
     * Updates the position in the xy-plane (pan)
     */
    public updatePan(dx: number, dy: number): void {
        this.position[0] += dx / this.scale[0];
        this.position[1] += dy / this.scale[1];
    }

    /**
     * Updates the scale factor
     */
    public updateScale(ds: number): void {
        if (this.scale[0] + ds > 0) {
            this.scale[0] += ds;
            this.scale[1] += ds;
        }
    }

    /**
     * Updates the camera orientation based on rotation angles
     */
    public updateRotation(dx: number, dy: number): void {
        // Rotate around up vector
        const rotX = mat4.fromRotation(mat4.create(), dx, this.viewUp);
        vec3.transformMat4(this.viewDir, this.viewDir, rotX);
        vec3.transformMat4(this.viewSide, this.viewSide, rotX);
        
        // Rotate around side vector
        const rotY = mat4.fromRotation(mat4.create(), dy, this.viewSide);
        vec3.transformMat4(this.viewDir, this.viewDir, rotY);
        vec3.transformMat4(this.viewUp, this.viewUp, rotY);
    }

    /**
     * Sets the light direction based on longitude and latitude
     */
    public setLighting(long: number, lat: number): void {
        this.lightDir[0] = Math.cos(lat) * Math.cos(long);
        this.lightDir[1] = Math.cos(lat) * Math.sin(long);
        this.lightDir[2] = Math.sin(lat);
        vec3.normalize(this.lightDir, this.lightDir);
    }

    /**
     * Updates the light direction by changing longitude and latitude
     */
    public updateLighting(dlong: number, dlat: number): void {
        const lat = Math.asin(this.lightDir[2]) + dlat;
        const long = Math.atan2(this.lightDir[1], this.lightDir[0]) + dlong;
        this.setLighting(long, lat);
    }

    /**
     * Updates the image size when the canvas is resized
     */
    public resize(size: number[]): void { 
        this.imageSize = size; 
    }

    /**
     * Updates volume parameters when the volume changes
     */
    public updateVolume(volume: Volume): void {
        this.volumeBounds = volume.boundingBox;
        this.volumeDataScale = volume.boundingBox[2] / volume.size[2];
    }
}