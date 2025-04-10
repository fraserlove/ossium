diagnostic(off, derivative_uniformity);

struct Uniforms {
    transform: mat4x4<f32>,
    lightPos: vec3<f32>,
    lightColour: vec3<f32>,
    diffuse: f32,
    specular: f32,
    ambient: f32,
    tfSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var volumeTexture: texture_3d<f32>;
@group(0) @binding(2) var volumeSampler: sampler;
@group(0) @binding(3) var tfTexture: texture_1d<f32>;

@vertex
fn vert_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
    // Create full-screen triangle using vertex index, using points: (-1,3), (-1,-1), and (3,-1)
    // which is larger than the screen space (-1 to 1), which is more efficient than using two triangles.
    var pos = array<vec2<f32>, 3>(
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    return vec4<f32>(pos[idx], 0.0, 1.0);
}

// Calculates the intersection points of a ray with an axis-aligned bounding box
// Algorithm - https://education.siggraph.org/static/HyperGraph/raytrace/rtinter3.htm
fn ray_box_intersection(bboxMin: vec3<f32>, bboxMax: vec3<f32>, pos: vec3<f32>, dir: vec3<f32>) -> vec2<f32> {
    var inv_dir = 1 / dir;                    // Inverse of ray direction
    var bot = inv_dir * (bboxMin - pos);      // Distances to minimum bounds
    var top = inv_dir * (bboxMax - pos);      // Distances to maximum bounds
    var rmin = min(top, bot);                 // Nearest intersection for each axis
    var rmax = max(top, bot);                 // Farthest intersection for each axis
    var near = max(rmin.x, max(rmin.y, rmin.z)); // Entry point - maximum of minimum intersections
    var far = min(rmax.x, min(rmax.y, rmax.z));  // Exit point - minimum of maximum intersections
    return vec2<f32>(near, far);
}

fn intensity(sample: vec4<f32>) -> f32 {
    return (sample.x + sample.y * 255) / 256; // Convert from RG8 format to normalised 16-bit value
}

fn normal(pos: vec3<f32>) -> vec3<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    
    // Calculate small offset for sampling
    let offset = 1.0 / size;
    
    // Calculate gradient using central differences along each axis
    var delta: vec3<f32>;
    delta.x = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(offset.x, 0.0, 0.0))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(offset.x, 0.0, 0.0)));
    delta.y = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(0.0, offset.y, 0.0))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(0.0, offset.y, 0.0)));
    delta.z = intensity(textureSample(volumeTexture, volumeSampler, pos + vec3<f32>(0.0, 0.0, offset.z))) - 
              intensity(textureSample(volumeTexture, volumeSampler, pos - vec3<f32>(0.0, 0.0, offset.z)));
    return normalize(delta);
}

@fragment
fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    var size = vec3<f32>(textureDimensions(volumeTexture));
    var accColour = vec4<f32>(0.0, 0.0, 0.0, 0.0);  // Accumulated color (RGBA)
    let shininess = 10.0;  // Shininess factor for specular calculation

    // Calculate ray origin and direction in volume space
    var pos = uniforms.transform * vec4<f32>(coord.xy, 0.0, 1.0); // Ray origin
    var dir = uniforms.transform * vec4<f32>(0.0, 0.0, 1.0, 0.0); // Ray direction
    
    // Find intersection with volume bounds
    var intersect = ray_box_intersection(vec3<f32>(0.0), size, pos.xyz, dir.xyz);
    var near = max(0, i32(intersect.x)); // Entry point (clamp to 0 if outside)
    var far = i32(intersect.y);          // Exit point

    // Ray marching loop
    for (var k = near; k <= far; k++) {
        var ray_pos = pos.xyz + f32(k) * dir.xyz;  // Current position along the ray
        // Scale down transformed coordinates to fit within 0->1 range
        var coords = ray_pos / size;

        let val = intensity(textureSample(volumeTexture, volumeSampler, coords));
        var norm = normal(coords); 
        
        // Look up color in transfer function
        let tfIndex = i32(val * uniforms.tfSize);
        var colour = textureLoad(tfTexture, tfIndex, 0);

        // Blinn-Phong lighting
        var lightDir = normalize(uniforms.lightPos - coords);
        var viewDir = normalize(coords);
        var halfDir = normalize(lightDir + viewDir);
        
        var diffuse = max(0.0, dot(norm, lightDir)) * uniforms.diffuse;
        var specular = pow(max(0.0, dot(norm, halfDir)), shininess) * uniforms.specular;
        var ambient = uniforms.ambient;
        var litColor = uniforms.lightColour * (colour.rgb * (diffuse + ambient) + specular);
        colour = vec4<f32>(litColor, colour.a);

        // Front-to-back composition
        var alpha = (1.0 - accColour.a) * colour.a;
        accColour = vec4<f32>(
            accColour.rgb + alpha * colour.rgb,  // Blend colors based on alpha
            accColour.a + alpha                  // Accumulate alpha
        );

        if (accColour.a >= 0.95) { break; }
    }

    return accColour;  // Return the final composited color
}