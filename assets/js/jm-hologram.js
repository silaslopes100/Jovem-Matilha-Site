(() => {
  "use strict";

  const A = {
    cols: 7,
    rows: 7,
    n: 45,
    srcW: 580,
    srcH: 570,
    cy: 0.3351,
    dogH: 368,
    dogW: 560,
  };
  const posOf = (d) =>
    d < -42 ? 8 - (-42 - d) / 6 : d > 42 ? 36 + (d - 42) / 6 : 8 + (d + 42) / 3;
  const HI =
    "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";

  function create(canvas, options) {
    const opts = options || {};
    if (!canvas) throw new Error("JMHologram.create requires a canvas.");
    if (!opts.atlas) throw new Error("JMHologram.create requires an atlas.");

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!gl) throw new Error("WebGL is unavailable for the hologram.");

    const maxYawDeg = opts.maxYawDeg === undefined ? 180 : opts.maxYawDeg;
    const maxPitch = opts.maxPitch === undefined ? 0.3 : opts.maxPitch;
    const follow = opts.follow === undefined ? 0.14 : opts.follow;
    const intro = opts.intro === undefined ? true : opts.intro;
    const introSeconds = opts.introSeconds === undefined ? 3.2 : opts.introSeconds;
    const color = opts.color || [0.22, 0.84, 0.7];
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    function makeProgram(vertexSource, fragmentSource, uniformNames) {
      const makeShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };
      const program = gl.createProgram();
      gl.attachShader(program, makeShader(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, HI + fragmentSource));
      gl.linkProgram(program);
      const result = {
        program,
        attribute: gl.getAttribLocation(program, "aUV"),
        uniforms: {},
      };
      uniformNames.forEach((name) => {
        result.uniforms[name] = gl.getUniformLocation(program, name);
      });
      return result;
    }

    function useProgram(result) {
      gl.useProgram(result.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(result.attribute);
      gl.vertexAttribPointer(result.attribute, 2, gl.FLOAT, false, 0, 0);
    }

    const dog = makeProgram(
      "attribute vec2 aUV;uniform vec2 uRes,uC,uQ;uniform float uPitch,uCy;varying vec2 vUV;" +
        "void main(){vec2 l=vec2((aUV.x-0.5)*uQ.x,-(aUV.y-uCy)*uQ.y);" +
        "float cp=cos(uPitch),sp=sin(uPitch);float y=l.y*cp,z=-l.y*sp;float k=1.0/(1.0-z/1500.0);" +
        "vec2 s=uC+vec2(l.x*k,-y*k);gl_Position=vec4(s.x/uRes.x*2.0-1.0,1.0-s.y/uRes.y*2.0,0.0,1.0);vUV=aUV;}",
      "varying vec2 vUV;uniform sampler2D uTex;uniform vec2 uGrid;uniform vec3 uCol;uniform float uPos,uMax,uT,uFront,uFx,uRing;" +
        "float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}" +
        "float f(float i,vec2 uv){vec2 c=vec2(mod(i,uGrid.x),floor(i/uGrid.x));return texture2D(uTex,(c+clamp(uv,0.006,0.994))/uGrid).r;}" +
        "void main(){vec2 uv=vUV;float g=uFx*exp(-pow((uT-4.0)*2.2,2.0));" +
        "uv.x+=g*(h(vec2(floor(uv.y*46.0),floor(uT*20.0)))-0.5)*0.05;" +
        "float i0=floor(uPos);float l=mix(f(i0,uv),f(min(i0+1.0,uMax),uv),uPos-i0);" +
        "float ab=uv.y-uFront;float vis=smoothstep(0.0,0.02,ab);" +
        "float bo=uFx*exp(-max(ab,0.0)/0.05)*step(-0.02,ab);" +
        "float sp=uFx*step(ab,0.0)*step(0.975,h(floor(uv*vec2(170.0,230.0))+floor(uT*14.0)))*smoothstep(0.02,0.15,l)*exp(ab/0.05)*2.0;" +
        "float ring=exp(-pow((uv.y-uRing)/0.022,2.0));" +
        "l=l*vis*(1.0+2.4*bo+1.6*ring)+sp;float al=clamp((l-0.035)*1.5,0.0,1.0);" +
        "vec3 c=mix(uCol,vec3(0.9,1.0,0.97),clamp(smoothstep(0.45,1.0,l)+bo*0.5,0.0,1.0));gl_FragColor=vec4(c*al,al);}",
      [
        "uRes",
        "uC",
        "uQ",
        "uPitch",
        "uCy",
        "uTex",
        "uGrid",
        "uCol",
        "uPos",
        "uMax",
        "uT",
        "uFront",
        "uFx",
        "uRing",
      ],
    );

    const fx = makeProgram(
      "attribute vec2 aUV;void main(){gl_Position=vec4(aUV*2.0-1.0,0.0,1.0);}",
      "uniform vec2 uRes;uniform vec3 uCol;uniform float uDpr,uT,uP,uFy,uCx,uDw;" +
        "float h(float n){return fract(sin(n*91.345)*47453.5453);}" +
        "void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;float W=uRes.x/uDpr;" +
        "float a=0.0;float e0=1.15*pow(1.0-uP,1.3)+0.015;" +
        "for(int i=0;i<28;i++){float fi=float(i);vec2 o=vec2(uCx+(h(fi)-0.5)*uDw*0.9,uFy);" +
        "float s=h(fi+7.0)>0.5?1.0:-1.0;float e=e0*(0.4+0.9*h(fi+3.0));vec2 d=vec2(s*cos(e),-sin(e));" +
        "vec2 q=p-o;float al=dot(q,d);float pe=abs(q.x*d.y-q.y*d.x);" +
        "a+=step(0.0,al)*smoothstep(1.1,0.0,pe)*exp(-al/(W*0.55))*(0.25+0.55*h(fi+11.0));}" +
        "a*=smoothstep(0.0,0.1,uT)*(1.0-smoothstep(0.88,1.0,uP));" +
        "float cw=11.0;float col=floor(p.x/cw);" +
        "float on=step(0.5,h(col+0.5))*step(col*cw,W*0.14)*step(W*0.012,col*cw);" +
        "float y=p.y-uT*(60.0+160.0*h(col+3.0));float row=floor(y/13.0);vec2 cl=vec2(mod(p.x,cw),mod(y,13.0));" +
        "float dt=step(0.72,h(col*13.7+row))*step(abs(cl.x-5.5),1.8)*step(abs(cl.y-6.5),1.8);" +
        "float r=on*dt*smoothstep(0.3,0.9,uT*0.5)*(1.0-smoothstep(4.5,8.0,uT));" +
        "float k=clamp(a*0.8+r,0.0,1.0);gl_FragColor=vec4(mix(uCol,vec3(0.9,1.0,0.97),0.35)*k,k);}",
      ["uRes", "uCol", "uDpr", "uT", "uP", "uFy", "uCx", "uDw"],
    );

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let dogHeight = 300;
    let centerY = 0;
    let elapsed = 0;
    let pointer = null;
    let texture = null;
    let destroyed = false;

    const image = new Image();
    const ready = new Promise((resolve, reject) => {
      image.onload = () => {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.LUMINANCE,
          gl.LUMINANCE,
          gl.UNSIGNED_BYTE,
          image,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        resolve();
      };
      image.onerror = () => reject(new Error("Failed to load the hologram atlas."));
      image.src = opts.atlas;
    });

    function resize(nextWidth, nextHeight, nextDpr) {
      if (destroyed) return;
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(nextDpr || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      dogHeight =
        typeof opts.dogH === "function"
          ? opts.dogH(width, height)
          : opts.dogH === undefined
            ? Math.min(height * 0.2, width * 0.2)
            : opts.dogH;
      centerY =
        typeof opts.cy === "function"
          ? opts.cy(width, height)
          : opts.cy === undefined
            ? height / 2
            : opts.cy;
    }

    function update(dt, nextPointer) {
      if (destroyed) return;
      elapsed += Math.max(0, dt);
      pointer = nextPointer || null;
    }

    function smoothStep(a, b, x) {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    function render() {
      if (destroyed || !texture || !width || !height) return;

      const t = intro ? elapsed : 99;
      const progress = intro ? smoothStep(0, 1, t / introSeconds) : 1;
      const gate = intro
        ? smoothStep(introSeconds - 0.6, introSeconds + 0.8, t)
        : 1;
      const isPointerActive = pointer !== null;
      const nx = isPointerActive
        ? Math.max(-1, Math.min(1, (pointer.x - width / 2) / (width * 0.4)))
        : Math.sin(elapsed * 0.6) * 0.1;
      const ny = isPointerActive
        ? Math.max(-1, Math.min(1, (pointer.y - height / 2) / (height * 0.4)))
        : Math.sin(elapsed * 0.45) * 0.07;
      look.x += (nx * gate - look.x) * follow;
      look.y += (ny * gate - look.y) * follow;

      const scale = dogHeight / A.dogH;
      const quadWidth = A.srcW * scale;
      const quadHeight = A.srcH * scale;
      const cx = width / 2 + look.x * 18;
      const cy = centerY + look.y * 10 + Math.sin(elapsed * 1.1) * 3;
      const front = intro && t < introSeconds + 0.4 ? 0.74 - 0.79 * progress : -1;
      const degrees = Math.max(
        -maxYawDeg,
        Math.min(maxYawDeg, -look.x * maxYawDeg),
      );
      const ring = t > introSeconds ? 0.68 - 0.66 * (((t - introSeconds) / 7) % 1) : -5;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (intro && t < 8.2) {
        useProgram(fx);
        gl.uniform2f(fx.uniforms.uRes, canvas.width, canvas.height);
        gl.uniform3f(fx.uniforms.uCol, color[0], color[1], color[2]);
        gl.uniform1f(fx.uniforms.uDpr, dpr);
        gl.uniform1f(fx.uniforms.uT, t);
        gl.uniform1f(fx.uniforms.uP, progress);
        gl.uniform1f(fx.uniforms.uFy, cy - A.cy * quadHeight + Math.max(front, 0) * quadHeight);
        gl.uniform1f(fx.uniforms.uCx, cx);
        gl.uniform1f(fx.uniforms.uDw, A.dogW * scale);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      useProgram(dog);
      gl.uniform2f(dog.uniforms.uRes, width, height);
      gl.uniform2f(dog.uniforms.uC, cx, cy);
      gl.uniform2f(dog.uniforms.uQ, quadWidth, quadHeight);
      gl.uniform1f(dog.uniforms.uPitch, -look.y * maxPitch);
      gl.uniform1f(dog.uniforms.uCy, A.cy);
      gl.uniform1i(dog.uniforms.uTex, 0);
      gl.uniform2f(dog.uniforms.uGrid, A.cols, A.rows);
      gl.uniform3f(dog.uniforms.uCol, color[0], color[1], color[2]);
      gl.uniform1f(dog.uniforms.uPos, Math.max(0, Math.min(A.n - 1, posOf(degrees))));
      gl.uniform1f(dog.uniforms.uMax, A.n - 1);
      gl.uniform1f(dog.uniforms.uT, t);
      gl.uniform1f(dog.uniforms.uFront, front);
      gl.uniform1f(dog.uniforms.uFx, front > -1 ? 1 : 0);
      gl.uniform1f(dog.uniforms.uRing, ring);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      image.onload = null;
      image.onerror = null;
      if (texture) gl.deleteTexture(texture);
      gl.deleteProgram(dog.program);
      gl.deleteProgram(fx.program);
      gl.deleteBuffer(buffer);
      const loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
    }

    const look = { x: 0, y: 0 };
    return { ready, resize, update, render, destroy };
  }

  window.JMHologram = { create };
})();
