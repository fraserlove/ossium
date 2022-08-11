import { mat4, vec3 } from 'gl-matrix';
import { Volume } from './volume';

export class Camera {
    private viewDirection: vec3 = vec3.create(); // Points towards volume - z-axis for camera
    private viewUp: vec3 = vec3.create(); // Points upwards from top of camera - x-axis for camera
    private viewSide: vec3 = vec3.create(); // Points parallel to image plane - y-axis for camera

    private imageSpacePanCine: vec3;
    private scale: vec3;

    private camera: mat4 = mat4.create();
    private view: mat4 = mat4.create();

    private lightDir: vec3;

    private imageSize: number[];
    private volumeBounds: number[];
    private volumeDataScale: number;

    constructor(volume: Volume) {
        this.volumeBounds = volume.getBoundingBox();
        this.volumeDataScale = volume.volumeDataScale();

        this.lightDir = vec3.fromValues(0, 0, 1);

        this.setScale(0.4);
        this.setPanCine(0, 0, this.volumeBounds[2] / 2);
        this.setViewDirection(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 1));
    }

    private CalculateViewMatrix(): void {
        this.camera = mat4.create();

        let viewBasisMatrix: mat4 = mat4.fromValues(
            this.viewSide[0], this.viewUp[0], this.viewDirection[0], 0,
            this.viewSide[1], this.viewUp[1], this.viewDirection[1], 0,
            this.viewSide[2], this.viewUp[2], this.viewDirection[2], 0,
            0, 0, 0, 1
        )
        // Scale z-axis according to volume-to-data ratio
        mat4.multiply(this.camera, mat4.fromScaling(mat4.create(), vec3.fromValues(1, 1, this.volumeDataScale)), this.camera);
        // Centre volume
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.volumeCentre()), this.camera);
        // Apply rotation
        mat4.multiply(this.camera, viewBasisMatrix, this.camera);
        // Apply cine-pan transformation
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.imageSpacePanCine), this.camera);
        // Apply scaling transformation
        mat4.multiply(this.camera, mat4.fromScaling(mat4.create(), this.scale), this.camera);
        // Re-centre the image in the window
        mat4.multiply(this.camera, mat4.fromTranslation(mat4.create(), this.imageCentre()), this.camera);
        mat4.invert(this.view, this.camera);
    }

    public getCameraMatrix(): Float32Array { this.CalculateViewMatrix(); return this.camera as Float32Array; }
    public getViewMatrix(): Float32Array { this.CalculateViewMatrix(); return this.view as Float32Array; }
    public getLightDir(): Float32Array { return this.lightDir as Float32Array; }

    private volumeCentre(): vec3 { return vec3.fromValues(-this.volumeBounds[0] / 2, -this.volumeBounds[1] / 2, -this.volumeBounds[2] / 2); }
    private imageCentre(): vec3 { return vec3.fromValues(this.imageSize[0] / 2, this.imageSize[1] / 2, 0); }

    private setViewDirection(viewDirection: vec3, viewUp: vec3): void {
        let viewSide: vec3 = vec3.create();
        vec3.cross(viewSide, viewDirection, viewUp);
        vec3.cross(this.viewUp, viewDirection, viewSide);
        this.viewDirection = viewDirection;
        this.viewSide = viewSide;
    }

    private setScale(s: number): void {
        if (s > 0) this.scale = vec3.fromValues(s, s, 1);
    }

    private setPanCine(x: number, y: number, z: number): void {
        this.imageSpacePanCine = vec3.fromValues(x, y, z);
    }

    public updateCine(dz: number): void {
        this.imageSpacePanCine[2] += dz;
    }

    public updatePan(dx: number, dy: number): void {
        this.imageSpacePanCine[0] += dx / this.scale[0];
        this.imageSpacePanCine[1] += dy / this.scale[1];
    }

    public updateScale(ds: number): void {
        if (this.scale[0] + ds > 0) {
            this.scale[0] += ds;
            this.scale[1] += ds;
        }
    }

    public updateRotation(dx: number, dy: number): void {
        vec3.transformMat4(this.viewDirection, this.viewDirection, mat4.fromRotation(mat4.create(), dx, this.viewUp));
        vec3.transformMat4(this.viewSide, this.viewSide, mat4.fromRotation(mat4.create(), dx, this.viewUp));
        vec3.transformMat4(this.viewDirection, this.viewDirection, mat4.fromRotation(mat4.create(), dy, this.viewSide));
        vec3.transformMat4(this.viewUp, this.viewUp, mat4.fromRotation(mat4.create(), dy, this.viewSide));
    }

    public updateLighting(dlong: number, dlat: number): void {
        let lat = (Math.asin(this.lightDir[2])) + dlat;
        let long = ((Math.atan2(this.lightDir[1], this.lightDir[0]))) + dlong;
        console.log(lat + " " + long);

        this.lightDir[0] = Math.cos(lat) * Math.cos(long);
        this.lightDir[1] = Math.cos(lat) * Math.sin(long);
        this.lightDir[2] = Math.sin(lat);
        vec3.normalize(this.lightDir, this.lightDir);
        console.log(this.lightDir[0] + " " + this.lightDir[1] + " " + this.lightDir[2]);
    }

    public resize(size: number[]): void { this.imageSize = size; }
}