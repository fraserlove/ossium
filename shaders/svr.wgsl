struct Uniforms {
    transform: mat4x4<f32>,
    lightPos: vec3<f32>,
    bbox: vec3<f32>,
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

    // Ray marching loop
    for (var k = 0; k < i32(size.z); k++) {
        var ray_pos = pos.xyz + f32(k) * dir.xyz;  // Current position along the ray
        // Scale down transformed coordinates to fit within 0->1 range
        var coords = ray_pos / size;

        let val = intensity(textureSample(volumeTexture, volumeSampler, coords));
        var norm = normal(coords); 

        if (all(coords >= vec3<f32>(0.0)) && all(coords <= vec3 <f32>(1.0))) {
        
            // Look up color in transfer function
            let tfIndex = i32(val * uniforms.tfSize);
            var colour = textureLoad(tfTexture, tfIndex, 0);

            // Lighting calculation using Blinn-Phong model
            var lightDir = normalize(uniforms.lightPos - coords);
            var viewDir = normalize(coords);
            var halfDir = normalize(lightDir + viewDir);
            
            // Calculate lighting components
            var diffuse = max(0.0, dot(norm, lightDir)) * uniforms.diffuse;
            var specular = pow(max(0.0, dot(norm, halfDir)), shininess) * uniforms.specular;
            var ambient = uniforms.ambient;
            
            // Apply lighting with light color
            var litColor = uniforms.lightColour * (colour.rgb * (diffuse + ambient) + specular);
            colour = vec4<f32>(litColor, colour.a);

            // Front-to-back composition using alpha blending
            var alpha = (1.0 - accColour.a) * colour.a;
            accColour = vec4<f32>(
                accColour.rgb + alpha * colour.rgb,  // Blend colors based on alpha
                accColour.a + alpha                  // Accumulate alpha
            );
        }
    }

    return accColour;  // Return the final composited color
}