struct Uniforms {
    transform: mat4x4<f32>,
    lightPos: vec3<f32>,
    bbox: vec3<f32>,
    lightColour: vec3<f32>,
    brightness: f32,
    slab: mat3x2<f32>,
    shininess: f32,
    transferWidth: f32,
    bitsPerVoxel: f32
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;
@group(0) @binding(2) var volumeSampler: sampler;
@group(0) @binding(3) var transferTexture: texture_2d<f32>;

@vertex
fn vert_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

// Algorithm - https://education.siggraph.org/static/HyperGraph/raytrace/rtinter3.htm
fn ray_box_intersection(bboxMin: vec3<f32>, bboxMax: vec3<f32>, pos: vec3<f32>, dir: vec3<f32>) -> vec2<f32> {
    var inv_dir = vec3<f32>(1 / dir.x, 1 / dir.y, 1 / dir.z);
    var bot = inv_dir * (bboxMin - pos);
    var top = inv_dir * (bboxMax - pos);
    var rmin = min(top, bot);
    var rmax = max(top, bot);
    var near = max(rmin.x, max(rmin.y, rmin.z));
    var far = min(rmax.x, min(rmax.y, rmax.z));
    return vec2<f32>(near, far);
}

fn intensity(sample: vec4<f32>) -> f32 {
    if (uniforms.bitsPerVoxel == 16) { return sample.x * 256 + sample.y * 65280; }
    else { return sample.x * 65536; }
}

fn normal(pos: vec3<f32>) -> vec3<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var delta = vec3<f32>(0, 0, 0);
    delta.x = intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x + 1), i32(pos.y * size.y), i32(pos.z * size.z)), 0)) - 
              intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x - 1), i32(pos.y * size.y), i32(pos.z * size.z)), 0));
    delta.y = intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x), i32(pos.y * size.y + 1), i32(pos.z * size.z)), 0)) - 
              intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x), i32(pos.y * size.y - 1), i32(pos.z * size.z)), 0));
    delta.z = intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x), i32(pos.y * size.y), i32(pos.z * size.z + 1)), 0)) - 
              intensity(textureLoad(volumeTexture, vec3<i32>(i32(pos.x * size.x), i32(pos.y * size.y), i32(pos.z * size.z - 1)), 0));
    return normalize(delta);
}

@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var accColour = vec4<f32>(0, 0, 0, 0);

    var pos = uniforms.transform * vec4<f32>(coord.xy, 0, 1);
    var dir = uniforms.transform * vec4<f32>(0, 0, 1, 0);
    var intersect = ray_box_intersection(vec3<f32>(0, 0, 0), size, pos.xyz, dir.xyz);
    var near = i32(intersect.x);
    var far = i32(intersect.y);

    for (var k = max(0, near); k < far; k++) {
        var coords = pos.xyz + f32(k) * dir.xyz;
        if (coords.x < uniforms.slab[0][0] || coords.x > uniforms.slab[0][1]) { continue; }
        if (coords.y < uniforms.slab[1][0] || coords.y > uniforms.slab[1][1]) { continue; }
        if (coords.z < uniforms.slab[2][0] || coords.z > uniforms.slab[2][1]) { continue; }
        // Scale down transformed coordinates to fit within 0->1 range
        coords = vec3<f32>(coords.x / size.x, coords.y / size.y, coords.z / size.z);
        
        // Use textureLoad instead of textureSample for uniform control flow
        var texCoords = vec3<i32>(i32(coords.x * size.x), i32(coords.y * size.y), i32(coords.z * size.z));
        var val = intensity(textureLoad(volumeTexture, texCoords, 0));
        var transferCoords = vec2<i32>(i32(val) % i32(uniforms.transferWidth), i32(val) / i32(uniforms.transferWidth));
        var colour: vec4<f32> = textureLoad(transferTexture, transferCoords, 0);

        // Lighting - Blinn-Phong
        var lightDir = normalize(uniforms.lightPos - coords);
        var viewDir = normalize(coords);
        var halfDir = normalize(lightDir + viewDir);
        var specular = pow(max(0.0, dot(normal(coords), halfDir)), uniforms.shininess);
        var diffuse = max(0.0, dot(normal(coords), lightDir));
        colour.r = colour.r * diffuse + specular * uniforms.lightColour.r;
        colour.g = colour.g * diffuse + specular * uniforms.lightColour.g;
        colour.b = colour.b * diffuse + specular * uniforms.lightColour.b;
        colour = uniforms.brightness * colour;

        // Composition
        if (colour.a == 0) { continue; }
        accColour.r += (1 - accColour.a) * colour.a * colour.r;
        accColour.g += (1 - accColour.a) * colour.a * colour.g;
        accColour.b += (1 - accColour.a) * colour.a * colour.b;
        accColour.a += (1 - accColour.a) * colour.a;
        if (accColour.a >= 0.95) { break; }
    }

    return accColour;
 }