import interact from 'https://cdn.interactjs.io/v1.10.0/interactjs/index.js';

main();

//
// Start here
//
function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');

  // If we don't have a GL context, give up now
  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  const fractals = {
    rk4: 'vec2 fractal(vec2 z, vec2 c) { return cmul(cmul(z,z),cmul(z,z))/24.0 + cmul(cmul(z,z),z)/6.0 + cmul(z,z)/2.0 + z + c; }',
    rk3: 'vec2 fractal(vec2 z, vec2 c) { return cmul(cmul(z,z),z)/6.0 + cmul(z,z)/2.0 + z + c; }',
    rk2: 'vec2 fractal(vec2 z, vec2 c) { return cmul(z,z)/2.0 + z + c; }',
    rk1: 'vec2 fractal(vec2 z, vec2 c) { return z + c; }',
    mandelbrot: 'vec2 fractal(vec2 z, vec2 c) { return cmul(z,z) + c; }',
    rk3twist: 'vec2 fractal(vec2 z, vec2 c) { return 3.0*cinv(z) + cmul(cmul(z,z),z)/6.0 + cmul(z,z)/2.0 + z + c; }',
  };

  // Set up the fractal type and precision.
  // Can only be changed with a recompilation of the shaders
  const fractal = fractals.rk3twist;
  const precision = 'highp'

  // Set up the fractal rendering parameters.
  // Can be changed on the fly without recompiling the shaders
  const escapetol = 1000.0;
  const maxiter = 11;
  const colorByIndex = true;
  const renderJuliaSet = true;
  const julia_xy = [1.0, 2.0];

  // Vertex shader program
  const vsSource = vertexShaderString();

  // Fragment shader program
  const fsSource = fragmentShaderString(fractal, precision)

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Tell WebGL to use our program when drawing
  gl.useProgram(shaderProgram);

  // Set fragment uniforms
  gl.uniform1f(gl.getUniformLocation(shaderProgram, 'uEscapeTol'), escapetol);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uMaxIter'), maxiter);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uColorByIndex'), colorByIndex);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uRenderJuliaSet'), renderJuliaSet);
  gl.uniform2fv(gl.getUniformLocation(shaderProgram, 'uJuliaXY'), julia_xy);

  // Set the palette
  const paletteTex = createTexture(gl);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, paletteTex);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uPalette'), 0);

  // Create the camera object
  const camera = new Camera(gl, shaderProgram);

  // Draw the scene
  function draw() {
    drawScene(gl, camera);
  }

  // interact.js
  addInteractions(gl, camera, draw);

  // Draw now
  draw();

}

/**
 * WebGL fragment shader.  fractal(z,c) is the fractal implementation
 * and escapetol determines when to break out of the loop
 */
function fragmentShaderString(fractal, precision) {
  return `
    precision ` + precision +  ` float;

    uniform int uMaxIter;
    uniform float uEscapeTol;
    uniform sampler2D uPalette;
    uniform bool uColorByIndex;
    uniform bool uRenderJuliaSet;
    uniform vec2 uJuliaXY;
    varying vec2 vPosition;

    #define cabs(a) ((a).x * (a).x + (a).y * (a).y)
    #define conj(a) (vec2((a).x, -(a).y))
    #define cinv(a) (conj(a)/cabs(a))
    #define cmul(a,b) (vec2((a).x * (b).x - (a).y * (b).y, (a).x * (b).y + (a).y * (b).x))

    ` + fractal + `

    float colormap(float c) {
      return pow(c,1.0/8.0);
    }

    void main() {
      vec2 z = vPosition;
      vec2 c = uRenderJuliaSet ? uJuliaXY : vPosition;
      int iter = 0;
      for (int i=0; i<200; i++) {
        z = fractal(z, c);

        iter += 1;
        if (cabs(z) >= uEscapeTol || iter >= uMaxIter) break;
      }

      float index = 0.0;
      if (uColorByIndex) {
        index = iter >= uMaxIter ? 0.0 : float(iter)/float(uMaxIter);
      } else {
        float color = cabs(z)/uEscapeTol;
        index = color >= 1.0 ? 0.0 : colormap(color);
      }
      gl_FragColor = texture2D(uPalette, vec2(index, 0.0));
    }  `;
}

/**
 * WebGL vertex shader code that goes along with the Camera object
 * for viewing the 2D plane
 */
function vertexShaderString() {
  return `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat2 uRotationMatrix;
    uniform float uZoom;
    uniform float uAspect;
    uniform vec2 uCenter;

    varying vec2 vPosition;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;

      float x = gl_Position[0]*uZoom*uAspect;
      float y = gl_Position[1]*uZoom;
      vPosition = uRotationMatrix * vec2(x, y) + uCenter;
    }  `;
}

/**
 * Camera object for viewing a 2D WebGL scene from above
 * @constructor
 * \param gl: WebGL object
 * \param shaderProgram: WebGL shader program object created with gl.createProgram()
 *   The shader program is required to have the following attributes:
 *     - aVertexPosition
 *   In addition the shader program must have the following uniforms:
 *     - (mat4) uProjectionMatrix
 *     - (mat4) uModelViewMatrix
 *     - (mat2) uRotationMatrix
 *     - (vec2) uCenter
 *     - (float) uZoom
 *     - (float) uAspect
 * This object is intended to work with the vertex shader defined by
 * vertexShaderString()
 */
function Camera(gl, shaderProgram) {
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      rotationMatrix: gl.getUniformLocation(shaderProgram, 'uRotationMatrix'),
      center: gl.getUniformLocation(shaderProgram, 'uCenter'),
      zoom: gl.getUniformLocation(shaderProgram, 'uZoom'),
      aspect: gl.getUniformLocation(shaderProgram, 'uAspect'),
    },
  };

  // Default positions
  this.center = [0.0, 0.0];
  this.angle = 0.0;
  this.zoom = 1.0;

  // Buffers and matrices used in the vertex shader
  this.positionBuffer = gl.createBuffer();
  this.projectionMatrix = mat4.create();
  this.modelViewMatrix = mat4.create();
  this.rotationMatrix = mat2.create();

  /**
   * Resize the view to the canvas dimensions.  This is automatically
   * called in draw() the aspect ratio has changed
   */
  this.resize = function() {
    this.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    this.positions = new Float32Array([
       this.aspect,  1.0,
      -this.aspect,  1.0,
       this.aspect, -1.0,
      -this.aspect, -1.0,
    ]);

    // Set the aspect ratio
    gl.uniform1f(programInfo.uniformLocations.aspect, this.aspect);

    // Update the projection matrix with the new aspect ratio
    {
      const fieldOfView = Math.PI / 2.0;
      const zNear = 0.1;
      const zFar = 100.0;
      mat4.perspective(this.projectionMatrix, fieldOfView, this.aspect, zNear, zFar);
      gl.uniformMatrix4fv(
          programInfo.uniformLocations.projectionMatrix,
          false,
          this.projectionMatrix);
    }
  }

  /**
   * Set the center of the camera view
   */
  this.setCenter = function(x, y) {
    // Update the center
    this.center[0] = x;
    this.center[1] = y;

    // Send it down
    gl.uniform2fv(programInfo.uniformLocations.center, this.center);
  }

  /**
   * Set the angle of the camera with respect to the x-axis
   */ 
  this.setAngle = function(angle) {
    // Set the angle
    this.angle = angle;
    mat2.fromRotation(this.rotationMatrix, this.angle);

    // Send it down
    gl.uniformMatrix2fv(
        programInfo.uniformLocations.rotationMatrix,
        false,
        this.rotationMatrix);
  }

  /**
   * Set the zoom amount
   */
  this.setZoom = function(scale) {
    // Update the zoom amount
    this.zoom = scale

    // Send it down
    gl.uniform1f(programInfo.uniformLocations.zoom, Math.pow(2.0, this.zoom));
  }

  /**
   * Draw the camera vertices to the scene
   */
  this.draw = function() {
    // Ensure the Camera's aspect matches that of the canvas
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    if (this.aspect != aspect) {
      this.resize();
    }

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.vertexPosition);
    }

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
  }

  // Create the model view matrix.  This is constant throughout the lifetime of the camera
  {
    mat4.translate(this.modelViewMatrix, this.modelViewMatrix, [0.0, 0.0, -1.0]);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        this.modelViewMatrix);
  }

  // Resize the view for the current width and height of the canvas
  this.resize();

}

function hex_to_rgb(hex) {
    const r = (hex & (0xff << 16)) >> 16;
    const g = (hex & (0xff << 8)) >> 8;
    const b = hex & 0xff;
    return {
        red: r,
        green: g,
        blue: b
    };
}

//
// Draw the scene.
//
function drawScene(gl, camera) {
  resize(gl);  // Resize if necessary

  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Tell the camera to draw its view
  camera.draw()

}

function createTexture(gl) {
  const palettes = {
    ugly: [0x303832, 0x74A37A, 0xD9F3E5, 0xD8BE91, 0xD8BE91, 0x9F4E43],
    classic: [0x212734, 0x6587B4, 0x69B6CD, 0xC3DFE9, 0xF8F0ED],
    victorian: [0x1c2031, 0x204457, 0x549499, 0xa7c7b7, 0x8b72c2, 0x6e5785, 0x413452, 0xc75672, 0xf96b69, 0xf5f1c9],
  }
  const hex_colors = palettes.victorian;
  const invert = false;
  const linear = true;

  const num_colors = hex_colors.length;
  const palette = new Uint8Array(num_colors * 4);
  function set_palette(index, hex, a) {
      const rgb = hex_to_rgb(hex);
      palette[index * 4 + 0] = rgb.red;
      palette[index * 4 + 1] = rgb.green;
      palette[index * 4 + 2] = rgb.blue;
      palette[index * 4 + 3] = a;
  }
  for (let i=0; i<num_colors; ++i) {
      const index = invert ? num_colors-1-i : i;
      set_palette(i, hex_colors[index], 255);
  }

  const paletteTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, paletteTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, num_colors, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, palette);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const round_mode = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, round_mode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, round_mode);

  return paletteTex;
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function resize(gl) {
  const canvas = gl.canvas

  // Lookup the size the browser is displaying the canvas.
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
 
  // Check if the canvas is not the same size.
  if (canvas.width != devicePixelRatio * displayWidth || 
      canvas.height != devicePixelRatio * displayHeight) {
    // Make the canvas the same size
    canvas.width  = devicePixelRatio * displayWidth;
    canvas.height = devicePixelRatio * displayHeight;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }
}

function addInteractions(gl, camera, draw) {
  // Draw to build the uniforms
  draw();

  // Add window resize listener
  window.addEventListener('resize', draw, true);

  // Defaults for camera location
  const drag_speed = 0.001;
  const defaults = {
    zoom: 1.0,
    center: [-1.0, 0.0],
    angle: 0.0,
  };
  setState(defaults.zoom, defaults.center, defaults.angle, false)

  // target elements with the "draggable" class
  interact('#glcanvas')
    .draggable({
      // enable inertial throwing
      inertia: {
        resistance: 5,
        minSpeed: 300,
        endSpeed: 20
      },
      listeners: {
        // call this function on every dragmove event
        move: dragMoveListener
      },
      max: Infinity,
      maxPerElement: 2
    })
    .gesturable({
      listeners: {
        start: gestureListener,
        move(event) {
          gestureListener(event, false);
          dragMoveListener(event, false);
          draw();
        },
        end: gestureListener
      },
      max: Infinity,
      maxPerElement: 1,
    })

  // Hide the name overlay when the user interacts with the canvas
  let nameHidden = false;
  function hideNameOverlay() {
    if (!nameHidden) {
      nameHidden = true;
      const nameOverlay = document.getElementById("nameOverlay");
      nameOverlay.classList.add("fade");
      setTimeout(function() {
        nameOverlay.style.display = "none";
      }, 300);
    }
  };

  // Drag to move
  function dragMoveListener(event, dodraw=true) {
    // Hide the name overlay upon interaction
    hideNameOverlay();

    // rotate the increments
    const vec = vec2.fromValues(event.dx, event.dy)
    vec2.rotate(vec, vec, vec2.fromValues(0.0, 0.0), -camera.angle);
    const dx = vec[0];
    const dy = vec[1];

    // update the center locations
    const scale = drag_speed * Math.pow(2.0, camera.zoom)
    const center_x = camera.center[0] - scale * dx;
    const center_y = camera.center[1] + scale * dy;
    camera.setCenter(center_x, center_y);

    if (dodraw) draw();
  }

  // Convert the gesture to a zoom event
  function gestureListener(event, dodraw=true) {
    const zoomEvent = {
      deltaY: -event.ds / 0.005,
    };
    zoomListener(zoomEvent, false);
    angleListener(event, false);

    if (dodraw) draw();
  }

  // Add scroll event listener
  function zoomListener(event, dodraw=true) {
    // Hide the name overlay upon interaction
    hideNameOverlay();

    // prevent dragging the canvas up/down along with the zoom
    if ('preventDefault' in event) event.preventDefault();

    // set the zoom of the camera object
    const zoom = camera.zoom + 0.005 * event.deltaY;
    camera.setZoom(zoom)

    if (dodraw) draw();
  }
  gl.canvas.addEventListener('wheel', zoomListener);

  // Add scroll event listener
  function angleListener(event, dodraw=true) {
    const angle = camera.angle + (Math.PI/180.0) * event.da;
    camera.setAngle(angle)

    if (dodraw) draw();
  }

  // Set state helper
  function setState(zoom, center, angle, dodraw=true) {
    camera.setZoom(zoom);
    camera.setCenter(center[0], center[1]);
    camera.setAngle(angle);

    if (dodraw) draw();
  }

  // Add the menu items
  const menu_home = document.getElementById('menu-home');
  menu_home.onclick = function() {
    console.log('home');
    setState(defaults.zoom, defaults.center, defaults.angle);
  }
  const menu_about = document.getElementById('menu-about');
  menu_about.onclick = function() {
    console.log('about');
    setState(-6.06, [-0.75379, -0.11206], 0.0);
  }
  const menu_info = document.getElementById('menu-info');
  menu_info.onclick = function() {
    console.log('info');
    setState(-6.06, [0.34212, 0.52298], 0.0);
  }
  const menu_contact = document.getElementById('menu-contact');
  menu_contact.onclick = function() {
    console.log('contact');
    setState(-2.4, [-1.98619, -0.00031829], 0.0);
  }
}

