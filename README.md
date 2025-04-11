# Ossium

A volume rendering application to display 3D volumes created from DICOM files in the browser, using WebGPU. Two rendering techniques are implemented: Multi-Planar Reformatting (MPR) using maximum intensity projection and Shaded Volume Rendering (SVR) using Blinn-Phong lighting. Ossium requires a [WebGPU-enabled](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) browser to run.

## Installation and Usage

Clone the repository and install the dependencies:
```sh
git clone https://github.com/fraserlove/ossium.git
yarn install
```
Build ossium and start the development server:
```sh
yarn build && yarn dev
```
The application runs on port `8080` and can be accessed in the browser by going to `http://localhost:8080`.

### Generating a Transfer Function

The transfer function is a 1D texture that maps the intensity values of the volume to colours. It is stored in a file with the `.tf` extension.

To generate a transfer function, run the following command:
```sh
python scripts/tf_generator.py
```
This will generate a transfer function file with the default settings. The transfer function can then be loaded into the application using the `Load Transfer Function` button in the GUI.

### Keybindings

| Action | Controls |
|--------|----------|
| Rotate | `Left Click` + Drag |
| Pan | `Right Click` + Drag |
| Zoom | `Vertical Scroll` |
| Cine | `Horizontal Scroll` |
| Change Light Direction | `Control` + `Left Click` + Drag (SVR only) |

## Examples

![MPR](assets/mpr.png)

![SVR](assets/svr.png)
