# Ossium

A WebGPU volume rendering application to display 3D medical imaging data in the browser. This application investigates and showcases the viability of the new WebGPU framework in client-side rendering of 3D medical imaging.

With a backend written using Python's Flask library the server deals with requests for imaging data and serves frontend WebGPU code to run in the browser. The application implements two rendering techniques: Multi-Planar Reformatting (MPR) rendering using maximum intensity projection and Shaded Volume Rendering (SVR) using Blinn-Phong lighting. The application provides parameters to vary the output render, and options to create an arbitrary number of renderers. Both DICOM and RAW volume and transfer function data are supported.

Note that in order to run WebGPU code your browser must [support WebGPU](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) and have it enabled.

<div style='display: inline-block'>
  <img src="assets/1.png" width="200"/>
  <img src="assets/2.png" width="200"/>
  <img src="assets/3.png" width="200"/>
  <img src="assets/4.png" width="200"/>
</div>

## Installation and Usage
Install the latest versions of Git, Yarn and Python.

Clone the repository and download and install Yarn and Python packages:
```bash
git clone https://github.com/fraserlove/ossium.git
cd ossium
make
```
Build the frontend application and start the backend Flask server, specifiying the path to the resource directory containing the volumes and transfer functions:
```bash
make start RESOURCES={path-to-resources}
```
The Flask server runs on port `8080` and can be accessed in the browser by going to `http://localhost:8080`. The application should load with options to add either an MPR or SVR renderer in the bottom right of the browser window. The application initially loads the lexicographically first volume by default.

## Controls, Settings and Keybindings
### MPR and SVR Keybindings:
- Rotate: `Left Click` + Drag
- Pan: `Right Click` + Drag
- Zoom: `Vertical Scroll`
- Cine: `Horizontal Scroll`

### Exclusive SVR Keybindings:
- Change light direction: `Shift` + `Left Click` + Drag

### Settings
A GUI is provided for each renderer to change settings such as:
- Slab X,Y and Z start and end points
- Window Width
- Window Level
- Shininess
- Brightness
- Light Colour
- Option to Include Specular

## Support Notes
- Due to the way volumes and transfer functions have been implemented, each volume and transfer function must have a unique filename as this is used to identify individual volumes and transfer functions. This includes the directory name holding DICOM files and the `.xml`/`.raw` pairs of as well - e.g. `Brain/` holding DICOM files and `Brain.xml`/`Brain.raw` cannot both exist.

- DICOM files must be placed under a named directory in the resources folder. The filename of this folder should describe the whole volume and is used as the unique identifier for the volume.

- DICOM files must be named in the order which they appear in the volume. So `img-001.dcm`, `img-002.dcm`, ... - where the numbers describe their position in the volume.

- The `.xml` and `.raw`/`.tf1` pairs of files for describing volumes and transfer functions must have the exact same filename as eachother and be placed directly under the resources directory in order to be loaded correctly. Inside each of the `.xml` files the corresponding `<Filename>` tag must match the exact `.raw` or `.tf1` filename.

- `.xml` files must contain valid XML, with a root node called either `<Transfer_Function>` or `<Volume_View>` for files specifying transfer function and volume metadata respectively.

- `.xml` files containing volume metadata must contain the tags - `<Width>`, `<Height>`, `<Image_count>`, `<Bits_per_voxel>`, `<Bytes_per_line>`, `<Pixel_Format>`, `<Bounding_box>` and `<Filename>`.

- `.xml` files containing transfer function metadata must contain the tags - `<Pixel_Format>`, `<Size>` and `<Filename>`.

- Once loaded, volumes specified in `.raw` and DICOM formats will be treated equally.

- Only `.raw` volume files with the pixel format `gray8`, `gray8s`, `gray16` and `gray16s` are supported.

- Only `.tf1` transfer function files with the pixel format `rgba32f` are supported.

- Loading of large `.raw` volumes can take some time, especially if the volume is in a signed format as the file is chunked and converted to an unsigned format before being streamed to the client. Waiting for volumes to load before attempting to change any render settings is advised to reduce likelihood of errors.

- Volume and transfer functions are loaded on demand, so only one volume and one transfer function is loaded in the clients browser at a time. This decreases load times and memory usage, however can result in longer wait time when changing volumes and transfer functions in the application.

- Useful client-side debug information can be found by opening up the console should any errors occur.

A typical resource folder could look like this:

```bash
./res
├── Abdomen
│   ├── img.001.dcm
│   ├── ...
│   └── img.250.dcm
├── Brain 
│   ├── scan-300.dcm
│   ├── ...
│   └── scan-640.dcm
├── Bone.tf1
├── Bone.xml
├── Lungs.raw
├── Lungs.xml
├── Hand.raw
└── Hand.xml
```

## Known Bugs

- Part of volume is cut off when rotating volumes with a width/height to depth ratio > 1. This effect worsens as the ratio increases past one and is most noticable on flatter volumes. This bug appears equally in both the MPR and SVR renderer.
