(() => {
  const dweetCache = {
    '701': { id: 701, user: 'sigveseb', src: '(F=Z=>{for(x.fillStyle=R(W=1/Z*4e3,W/2,W/4),i=Z*Z*2;n=i%Z,m=i/Z|0,i--;n%2^m%2&&x.fillRect((n-t%2-1)*W,(S(t)+m-1)*W,W,W));Z&&F(Z-6)})(36)//rm' },
    '888': { id: 888, user: 'jczimm', src: 'c.width=1920;for(i=0;i<300;i++)for(j=0;j<6;j++){x.fillRect(960+200*C(i)*S(T(t\/1.1)+j\/i),540+200*S(i),10,10)}' },
    '1231': { id: 1231, user: 'iverjo', src: 'c.width^=0;for(i=9;i<2e3;i+=2)s=3\/(9.1-(t+i\/99)%9),x.beginPath(),j=i*7+S(i*4+t+S(t)),x.lineWidth=s*s,x.arc(960,540,s*49,j,j+.6),x.stroke()' },
    '739': { id: 739, user: 'donbright', src: 'c.width=900;\u534A=450;for(i=0.0;i<360;i+=1){x.lineTo(\u534A+C(i*t\/10)*i,\u534A*9\/16+S(i*t\/10)*i)};x.stroke();' },
    '933': { id: 933, user: 'p01', src: 'for(d=2e3;d--;x.fillRect(960+d*C(a),540+d*S(a),24,24))a=Math.random()*6.3,x.fillStyle=R(e=255*C(t-1e3\/d*S(t-a-C(a*99\/d))),99*S(a-e\/d),6e4\/d)' }
  };

  // const dweetIds = [ 701, 888, 1231, 739, 933, 676, 855, 683, 1829, 697, 433, 135 ];
  const dweetIds = [ 701, 888, 1231, 739, 933 ];
  //const audioUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/9473/new_year_dubstep_minimix.ogg';
  const audioUrl = 'new_year_dubstep_minimix.ogg';

  /* Frame advancers */

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

  /* Dweet advancers */

  const beatConcsciousDweetAdvancer = {
    waitTime: null,
    lastAdvanceTime: null,
    waitBy: function (time) {
      this.waitTime = time;
      this.lastAdvanceTime = Date.now();
    },
    beat: function () {
      if (!this.waitTime) {
        return;
      }

      const now = Date.now();

      if (now - this.lastAdvanceTime >= this.waitTime) {
        advanceToNextDweet();
        this.lastAdvanceTime = now;
      }
    }
  };

  let beat = 0;

  function beatHandler() {
    beatConcsciousDweetAdvancer.beat();
  }

  /* Blenders */

  const overwriteBlender = {
    beforeDraw: function (ctx) {
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
    },
    afterDraw: function (ctx) {
      ctx.globalAlpha = 1;
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
    },
    afterDraw: function (ctx) {
      ctx.globalAlpha = 1;
    }
  };

  const zoomToBeatBlender = {
    beforeDraw: function (ctx) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.translate(-w * beat / 4, -h * beat / 4);
      ctx.scale(1 + beat / 2, 1 + beat / 2);
    },
    afterDraw: function (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  const progressRendererDweet = () => {
    '--marker--';
    x.clearRect(0, 0, c.width, c.height);
    x.beginPath();
    x.arc(c.width / 2, c.height / 2, c.height / 3, 0, 2 * Math.PI * -t, true);
    x.lineCap = 'round';
    x.lineWidth = c.height / 20 * (1 - t);
    x.stroke();
    '--marker--';
  }

  let dweet = createRuntime({ src: progressRendererDweet.toString().split("'--marker--';")[1] });
  let frameAdvancer = progressFrameAdvancer;
  let blender = overwriteBlender;

  let dweets = [];
  let dweetIdx = 0;

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getCanvas() {
    return new Promise((resolve) => $(() => resolve($("#c").get(0))));
  }

  function setStatus(tpl, params) {
    $('#status').html(tpl.replace(/\$\{(.+?)\}/g, (s, name) => params[name]));
  }

  function setDweetInfo(id, user) {
    setStatus($('#dweet-info-tpl').html(), { id, user });
  }

  function setupRendering(canvas) {
    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext('2d');

    function render() {
      requestAnimationFrame(render);

      dweet.setFrame(frameAdvancer.getFrame());

      try {
        dweet.render();
      } catch (e) {
        console.error(e);
        return;
      }

      blender.beforeDraw(ctx);

      const dc = dweet.canvas;

      ctx.drawImage(
        dc,
        0, 0, dc.width, dc.width * 1080 / 1920,
        0, 0, canvas.width, canvas.height
      );

      blender.afterDraw && blender.afterDraw(ctx);
    }

    render();
  }

  function decodeAudio(data, ctx) {
    return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
  }

  function setupAudio(data) {
    const ctx = new AudioContext();

    const source = ctx.createBufferSource();

    source.loop = true;

    const processor = ctx.createScriptProcessor(2048, 1, 1);

    const analyser = ctx.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 1024;

    source.connect(analyser);
    analyser.connect(processor);

    const bins = new Uint8Array(analyser.frequencyBinCount);

    let prevAvg = 0;

    processor.onaudioprocess = () => {
      analyser.getByteFrequencyData(bins);

      let sum = 0;

      for (let i = 0; i < bins.length; i++) {
        sum += bins[i];
      }

      const avg = sum / bins.length;

      if (avg - prevAvg > 25) {
        beat = 1;
        beatHandler();
      } else {
        beat *= 0.5;
      }

      prevAvg = avg;
    };

    processor.connect(ctx.destination);
    source.connect(ctx.destination);

    return decodeAudio(data, ctx)
      .then((buffer) => {
        source.buffer = buffer;
        source.start();
      });
  }

  function fetchDweet(id, idx) { // @todo idx only needed for fake progress
    const cached = dweetCache[id];
    const fetch = cached
      ? pause(100 * idx).then(() => cached)
      : $.ajax(`/api/dweets/${id}`, { dataType: 'json' });

    return fetch
      .then(createRuntime);
  }

  function fetchAudio(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open('GET', url, true);
      request.responseType = 'arraybuffer';

      request.onload = () => resolve(request.response);

      request.send();
    });
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

  function setActiveDweet(idx) {
    dweetIdx = idx;
    dweet = dweets[dweetIdx];
    setDweetInfo(dweet.id, dweet.user);
  }

  function advanceToNextDweet() {
    setActiveDweet((dweetIdx + 1) % dweets.length);
  }

  const tasks = (() => {
    let total = 0;
    let pending = 0;
    const taskList = [];

    return {
      add: (task) => {
        total++;
        pending++;

        taskList.push(tasks);

        return task
          .then((result) => {
            progressFrameAdvancer.updateProgress(--pending, total);
            return result;
          });
      },
      whenDone: () => {
        return Promise.all(taskList);
      }
    };
  })();

  tasks
    .add(getCanvas())
    .then(setupRendering);

  tasks
    .add(fetchAudio(audioUrl))
    .then(setupAudio);

  dweetIds
    // .sort(function () { return Math.random() - 0.5; })
    // .slice(0, 3)
    .forEach((id, idx) => tasks
      .add(fetchDweet(id, idx))
      .then((dweet) => dweets.push(dweet))
    );

  tasks.whenDone()
    .then(() => pause(2000))
    .then(() => {
      setActiveDweet(0);
      frameAdvancer = monotonousFrameAdvancer;
      blender = fadeOutToWhiteBlender.reset();

      return pause(5000);
    })
    .then(() => {
      advanceToNextDweet();
      blender = zoomToBeatBlender;
      beatConcsciousDweetAdvancer.waitBy(5000);
    });
})();
