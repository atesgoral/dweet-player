(() => {
  const defaultTimeline = [ 701, 888, 1231, 739, 933, 855, 683, 1829, 433, 135 ].map((dweetId) => ({ dweetId }));

  // const loaders = [ 3096, 3097, 3098, 3115, 3110, 3114, 3108, 3109 ];
  const loaders = [ 3096, 3097 ];

  const trackUrl = [
    'http://freemusicarchive.org/music/Creo/~/Memory_1520',
    'http://freemusicarchive.org/music/Pierlo/Olivetti_Prodest/05_San_Diego_Cruisin',
  ][0];

  function decodeTimeline(s) {
    const tokens = /^v(.+):(.+)$/.exec(s);

    if (!tokens) {
      return null;
    }

    const version = tokens[1];
    const ids = tokens[2];

    if (version !== '1') {
      return null;
    }

    return ids.split(',').map((s) => {
      return {
        dweetId: parseInt(s, 10)
      };
    });
  }

  function encodeTimeline(timeline) {
    return 'v1:' + timeline.map((scene) => scene.dweetId).join(',');
  }

  const timeline = location.search
    && decodeTimeline(location.search.slice(1))
    || defaultTimeline;

  function getUniqueDweetIdsFromTimeline(timeline) {
    return Object.keys(
      timeline.reduce((idMap, scene) => {
        idMap[scene.dweetId] = 1;
        return idMap;
      }, {})
    );
  }

  const url = location.href.split('?').slice(0, 1).concat(encodeTimeline(timeline)).join('?');
  history.replaceState({}, '', url);

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

  const beatConsciousFrameAdvancer = {
    frame: 0,
    getFrame: function () {
      const frame = this.frame;

      this.frame += 1 + beat * 4;

      return frame;
    }
  };

  /* Dweet advancers */

  const beatConcsciousSceneAdvancer = {
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
        advanceToNextScene();
        this.lastAdvanceTime = now;
      }
    }
  };

  let beat = 0;

  function beatHandler() {
    beatConcsciousSceneAdvancer.beat();
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

  const horizontalMirrorBlender = {
    beforeDraw: function (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    draw: function (ctx, dc) {
      const c = ctx.canvas;
      ctx.drawImage(dc, 0, 0, dc.width / 2, dc.width * 1080 / 1920, 0, 0, c.width / 2, c.height);
      ctx.scale(-1, 1);
      ctx.drawImage(dc, 0, 0, dc.width / 2, dc.width * 1080 / 1920, -c.width / 2, 0, -c.width / 2, c.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  const flashToBeatBlender = {
    beforeDraw: function (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    afterDraw: function (ctx) {
      ctx.globalAlpha = beat;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
  };

  let dweet = null;

  let frameAdvancer = progressFrameAdvancer;
  let blender = overwriteBlender;

  let dweets = {};
  let sceneIdx = 0;
  let scene = null;
  let track = null;

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getCanvas() {
    return new Promise((resolve) => $(() => resolve($("#c").get(0))));
  }

  function showTrackInfo(track) {
    const tpl = $('#track-info-tpl').html();
    const params = track;

    $('#track-info').html(tpl.replace(/\$\{(.+?)\}/g, (s, name) => params[name]));
  }

  function showDweetInfo(dweet) {
    const tpl = $('#dweet-info-tpl').html();
    const params = Object.assign({
      dweetUrl: `https://www.dwitter.net/d/${dweet.id}`,
      authorUrl: `https://www.dwitter.net/u/${dweet.author}`,
      length: dweet.src.length
    }, dweet);

    $('#dweet-info').html(tpl.replace(/\$\{(.+?)\}/g, (s, name) => params[name]));
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

      blender.beforeDraw && blender.beforeDraw(ctx);

      const dc = dweet.canvas;

      if (blender.draw) {
        blender.draw(ctx, dc)
      } else {
        ctx.drawImage(
          dc,
          0, 0, dc.width, dc.width * 1080 / 1920,
          0, 0, canvas.width, canvas.height
        );
      }

      blender.afterDraw && blender.afterDraw(ctx);

      if (isBeatOverlayEnabled) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'orange';

        const binW = canvas.width / gbins.length;
        let binX = 0;

        for (let i = 0; i < gbins.length; i++) {
          binX = i * binW;
          ctx.fillRect(binX, canvas.height / 2 - gbins[i], binW, gbins[i]);
        }

        ctx.fillStyle = 'blue';
        ctx.fillRect(0, canvas.height / 2 + 40 - beat * 10, canvas.width, beat * 20);
        ctx.fillStyle = 'gray';
        ctx.fillRect(0, canvas.height - gra * 2 - 1, canvas.width, 1);
        ctx.fillStyle = 'red';
        ctx.fillRect(0, canvas.height - gavg * 2 - 1, canvas.width, 1);
      }
    }

    render();
  }

  function decodeAudio(data, ctx) {
    return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
  }

  let source = null;
  let gain = null;

  const isBeatOverlayEnabled = false;
  // @todo bad names: globals for beat overlay
  let gra = 0;
  let gavg = 0;
  let gbins = [];

  function setupAudio(data) {
    const ctx = new AudioContext();

    source = ctx.createBufferSource();
    gain = ctx.createGain();

    source.loop = true;

    // const filter = ctx.createBiquadFilter();

    // filter.type = 'bandpass';
    // filter.frequency.value = 180;
    // filter.Q.value = 10;

    const processor = ctx.createScriptProcessor(2048, 1, 1);

    const analyser = ctx.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 1024;

    // source.connect(filter);
    // filter.connect(analyser);
    source.connect(analyser);
    analyser.connect(processor);

    const bins = new Uint8Array(analyser.frequencyBinCount);
    gbins = bins;

    const avgBuff = Array(4).fill(0);
    let avgPos = 0;
    let avgSum = 0;

    processor.onaudioprocess = () => {
      analyser.getByteFrequencyData(bins);

      let sum = 0;

      for (let i = 0; i < bins.length; i++) {
        sum += bins[i];
      }

      const avg = sum / bins.length;
      const avgSqr = avg * avg;

      avgBuff[avgPos] = avgSqr;

      const nextPos = (avgPos + 1) % avgBuff.length;

      avgSum += avgSqr - avgBuff[nextPos];
      avgPos = nextPos;

      const runningAvg = Math.sqrt(avgSum / avgBuff.length);
      gra = runningAvg;
      gavg = avg;

      if (avg / (runningAvg + 0.00001) > 1.3) {
        beat = 1;
        beatHandler();
      } else {
        beat *= 0.5;
      }

      prevAvg = avg;
    };

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.1;

    processor.connect(ctx.destination);

    source.connect(delay);
    delay.connect(gain);
    gain.connect(ctx.destination);
    // filter.connect(ctx.destination);

    return decodeAudio(data, ctx)
      .then((buffer) => source.buffer = buffer);
  }

  function setupUi() {
    const $container = $('#container');

    $('#full-screen')
      .prop('disabled', !screenfull.enabled)
      .on('click', () => screenfull.request($container[0]));

    screenfull.on('change', () => {
      $container.attr('full-screen', screenfull.isFullscreen);
    });

    $('#toggle-audio')
      .on('click', function () {
        $(this).find('.icon.-speaker').toggleClass('-on -off');
        toggleAudio();
      });
  }

  function startAudio() {
    source.start();
  }

  function toggleAudio() {
    gain.gain.value ^= 1;
  }

  function setTrack(_track) {
    return track = _track;
  }

  function setDweet(_dweet) {
    return dweet = _dweet;
  }

  function fetchTrack(url) {
    return $.ajax(`/api/tracks/${encodeURIComponent(url)}`, { dataType: 'json' });
  }

  function fetchDweet(id) {
    return $.ajax(`/api/dweets/${id}`, { dataType: 'json' })
      .then(createRuntime);
  }

  function fetchAudio(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open('GET', `/api/proxy/${encodeURIComponent(url)}`, true);
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

  function setActiveScene(idx) {
    sceneIdx = idx;
    scene = timeline[idx];

    blender = overwriteBlender;
    //blender = zoomToBeatBlender;
    //blender = flashToBeatBlender;
    //blender = horizontalMirrorBlender

    frameAdvancer = beatConsciousFrameAdvancer;
    beatConcsciousSceneAdvancer.waitBy(4000);
    // monotonousFrameAdvancer,
    // beatConsciousFrameAdvancer

    blender = overwriteBlender;
    // fadeOutToWhiteBlender.reset(),
    // overwriteBlender,
    // zoomToBeatBlender,
    // flashToBeatBlender,
    // horizontalMirrorBlender

    dweet = dweets[scene.dweetId];
    showDweetInfo(dweet);
  }

  function advanceToNextScene() {
    setActiveScene((sceneIdx + 1) % timeline.length);
  }

  const tasks = (() => {
    let total = 0;
    let pending = 0;
    const taskList = [];

    return {
      add: (task) => {
        total++;
        pending++;

        taskList.push(task);

        return task
          .then((result) => {
            progressFrameAdvancer.updateProgress(--pending, total);
            return result;
          });
      },
      whenDone: () => Promise.all(taskList)
    };
  })();

  fetchDweet(loaders[Math.random() * loaders.length | 0])
    .then(setDweet)
    .then(() => {
      tasks.add(getCanvas()
        .then(setupRendering)
        .then(setupUi)
        .then(() => showDweetInfo(dweet))
      );

      tasks.add(fetchTrack(trackUrl)
        .then(setTrack)
        .then((track) => fetchAudio(track.audioUrl))
        .then(setupAudio)
      );

      getUniqueDweetIdsFromTimeline(timeline)
        .forEach((dweetId, idx) => tasks.add(fetchDweet(dweetId)
          .then((dweet) => dweets[dweetId] = dweet)
        ));

      tasks.whenDone()
        .then(() => pause(1000))
        .then(() => {
          showTrackInfo(track);
          startAudio();
          setActiveScene(0);
          //frameAdvancer = monotonousFrameAdvancer;
          frameAdvancer = beatConsciousFrameAdvancer
          blender = fadeOutToWhiteBlender.reset();

          return pause(5000);
        })
        .then(() => advanceToNextScene());
    });
})();
