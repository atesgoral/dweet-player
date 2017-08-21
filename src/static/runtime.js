(() => {
  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const dweetCache = {
    '701': { id: 701, user: 'sigveseb', src: '(F=Z=>{for(x.fillStyle=R(W=1/Z*4e3,W/2,W/4),i=Z*Z*2;n=i%Z,m=i/Z|0,i--;n%2^m%2&&x.fillRect((n-t%2-1)*W,(S(t)+m-1)*W,W,W));Z&&F(Z-6)})(36)//rm' },
    '888': { id: 888, user: 'jczimm', src: 'c.width=1920;for(i=0;i<300;i++)for(j=0;j<6;j++){x.fillRect(960+200*C(i)*S(T(t\/1.1)+j\/i),540+200*S(i),10,10)}' },
    '1231': { id: 1231, user: 'iverjo', src: 'c.width^=0;for(i=9;i<2e3;i+=2)s=3\/(9.1-(t+i\/99)%9),x.beginPath(),j=i*7+S(i*4+t+S(t)),x.lineWidth=s*s,x.arc(960,540,s*49,j,j+.6),x.stroke()' },
    '739': { id: 739, user: 'donbright', src: 'c.width=900;\u534A=450;for(i=0.0;i<360;i+=1){x.lineTo(\u534A+C(i*t\/10)*i,\u534A*9\/16+S(i*t\/10)*i)};x.stroke();' },
    '933': { id: 933, user: 'p01', src: 'for(d=2e3;d--;x.fillRect(960+d*C(a),540+d*S(a),24,24))a=Math.random()*6.3,x.fillStyle=R(e=255*C(t-1e3\/d*S(t-a-C(a*99\/d))),99*S(a-e\/d),6e4\/d)' }
  };

  function fetchDweet(id, idx) { // @todo idx only needed for fake progress
    const cached = dweetCache[id];
    const fetch = cached
      ? pause(100 * idx).then(() => cached)
      : $.ajax(`/api/dweets/${id}`, { dataType: 'json' });

    return fetch
      .then(createRuntime);
  }

  // @todo pass in as arg to IIFE
  function createRuntime() {
    var $ = undefined; // Hide jQuery

    var c = document.createElement('canvas');

    c.width = 1920;
    c.height = 1080;

    var S = Math.sin;
    var C = Math.cos;
    var T = Math.tan;

    function R(r,g,b,a) {
      a = a === undefined ? 1 : a;
      return "rgba("+(r|0)+","+(g|0)+","+(b|0)+","+a+")";
    };

    var x = c.getContext("2d");
    var time = 0;
    var frame = 0;

    eval(`var u = function u(t) {\n${arguments[0].src}\n}`);

    return Object.assign(arguments[0], {
      canvas: c,
      setFrame: (f) => {
        frame = f;
        time = frame / 60;

        if (time * 60 | 0 == frame - 1) {
          time += 0.000001;
        }
      },
      render: () =>u(time)
    });
  }

  const renderProgress = () => {
    '--marker--';
    x.beginPath();
    x.arc(c.width / 2, c.height / 2, c.height / 3, 0, 2 * Math.PI * -t, true);
    x.lineCap = 'round';
    x.lineWidth = c.height / 20;
    x.stroke();
    '--marker--';
  }

  const progressFrameAdvancer = {
    done: 0,
    fakeProgress: 0,
    getFrame: function () {
      this.fakeProgress += (this.done - this.fakeProgress) / ((1 - this.done) * 90 + 10);
      return this.fakeProgress * 60;
    },
    updateProgress: function (pending, total) {
      this.done = 1 - pending / total;
    }
  };

  const monotonousFrameAdvancer = {
    frame: 0,
    getFrame: function () {
      return this.frame++;
    }
  };

  const sineFrameAdvancer = {
    a: 0,
    frame: 0,
    getFrame: function () {
      const frame = this.frame;

      this.frame += Math.sin(this.a += 0.01);

      return frame;
    }
  };

  const overwriteBlender = {
    beforeDraw: function (ctx) {
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };

  const fadeOutToWhiteBlender = {
    opacity: 0,
    reset: function () {
      this.opacity = 0;
      return this;
    },
    beforeDraw: function (ctx) {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      if (this.opacity < 1) {
        this.opacity += 0.01;
      }
    }
  };

  const fadeBlender = {
    opacity: 0,
    reset: function () {
      this.opacity = 0;
      return this;
    },
    beforeDraw: function (ctx) {
      ctx.globalAlpha = this.opacity;

      if (this.opacity < 1) {
        this.opacity += 0.01;
      }
    }
  };

  function getCanvas() {
    return new Promise((resolve) => $(() => resolve($("#c").get(0))));
  }

  getCanvas()
    .then((canvas) => {
      let renderer = createRuntime({ src: renderProgress.toString().split("'--marker--';")[1] });
      let frameAdvancer = progressFrameAdvancer;
      let blender = overwriteBlender;

      canvas.width = 1920;
      canvas.height = 1080;

      const ctx = canvas.getContext('2d');

      function render() {
        requestAnimationFrame(render);

        //const renderer = renderers[(frameCount / 100 | 0) % renderers.length];

        renderer.setFrame(frameAdvancer.getFrame());

        try {
          renderer.render();

          blender.beforeDraw(ctx);

          ctx.drawImage(
            renderer.canvas,
            0, 0, renderer.canvas.width, renderer.canvas.width * 1080 / 1920,
            0, 0, canvas.width, canvas.height
          );
        } catch (e) {
          console.error(e);
        }
      }

      function setStatus(tpl, params) {
        $('#status').html(tpl.replace(/\$\{(.+?)\}/g, (s, name) => params[name]));
      }

      function setDweetInfo(id, user) {
        setStatus($('#dweet-info-tpl').html(), { id, user });
      }

      render();

      let dweetRenderers = [];
      let total = 0;
      let pending = 0;

      function progress() {
        progressFrameAdvancer.updateProgress(--pending, total);
        return arguments[0];
      }

      // let dweetIds = [ 701, 888, 1231, 739, 933, 676, 855, 683, 1829, 697, 433, 135 ];
      let dweetIds = [ 701, 888, 1231, 739, 933 ];

      const fetches = dweetIds
        // .sort(function () { return Math.random() - 0.5; })
        // .slice(0, 3)
        .map((id, idx) => {
          total++;
          pending++;

          return fetchDweet(id, idx)
            .then(progress);
        });

      Promise.all(fetches)
        .then((_dweetRenderers) => {
          dweetRenderers = _dweetRenderers;
        })
        .then(() => pause(1000))
        .then(() => {
          let dweetIdx = 0;

          frameAdvancer = monotonousFrameAdvancer;
          renderer = dweetRenderers[dweetIdx];
          setDweetInfo(renderer.id, renderer.user);
          blender = fadeOutToWhiteBlender.reset();

          setInterval(() => {
            dweetIdx = (dweetIdx + 1) % dweetRenderers.length;
            frameAdvancer = sineFrameAdvancer;
            renderer = dweetRenderers[dweetIdx];
            setDweetInfo(renderer.id, renderer.user);
            // blender = fadeBlender.reset();
            blender = overwriteBlender;
          }, 5000);
        });
    });
})();
