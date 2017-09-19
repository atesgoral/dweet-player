(() => {
  const defaultLoaderDweetIds = [ 3096, 3097 ];

  const defaultDemoStr = '/demo/v1/*/701w,888,1231,739,933,855,683,1829t8h,433,135/'
    + [
      'http://freemusicarchive.org/music/Graham_Bole/First_New_Day/Graham_Bole_-_12_-_We_Are_One',
      'http://freemusicarchive.org/music/Nctrnm/HOMME/Survive129Dm',
      'http://freemusicarchive.org/music/Creo/~/Memory_1520',
      'http://freemusicarchive.org/music/Pierlo/Olivetti_Prodest/05_San_Diego_Cruisin',
    ][0];

  function getRandomLoaderDweetId() {
    return defaultLoaderDweetIds[defaultLoaderDweetIds.length * Math.random() | 0];
  }

  /* Frame advancers */

  class MonotonousFrameAdvancer {
    constructor() {
      this.reset()
    }

    reset() {
      this.frame = 0;
    }

    getFrame() {
      return this.frame++;
    }
  }

  class ProgressFrameAdvancer {
    constructor() {
      this.reset();
    }

    reset() {
      this.done = 0;
      this.fakeProgress = 0;
    }

    getFrame() {
      this.fakeProgress += (this.done - this.fakeProgress) / ((1 - this.done) * 90 + 10);
      return this.fakeProgress * 60;
    }

    updateProgress(pending, total) {
      this.done = 1 - pending / total;
    }
  }

  class BeatBounceFrameAdvancer {
    constructor(factor) {
      this.factor = factor;
      this.reset();
    }

    reset() {
      this.frame = 0;
    }

    getFrame() {
      return this.frame++ + beat * this.factor;
    }
  }

  class BeatRushFrameAdvancer {
    constructor(factor) {
      this.factor = factor;
      this.reset();
    }

    reset() {
      this.frame = 0;
    }

    getFrame() {
      const frame = this.frame;

      this.frame += 1 + beat * this.factor;

      return frame;
    }
  }

  /* Scene advancers */

  class StubSceneAdvancer {
    reset() {}
    beat() {}
    setFrame() {}
  }

  class ExactTimeSceneAdvancer {
    constructor(seconds, onAdvanceScene) {
      this.targetSeconds = seconds;
      this.onAdvanceScene = onAdvanceScene;
    }

    reset() {}
    beat() {}

    setFrame(frame) {
      const elapsedSeconds = frame / 60;

      if (elapsedSeconds >= this.targetSeconds) {
        this.onAdvanceScene();
      }
    }
  }

  class ApproxTimeSceneAdvancer {
    constructor(seconds, onAdvanceScene) {
      this.targetSeconds = seconds;
      this.onAdvanceScene = onAdvanceScene;
    }

    reset() {
      this.elapsedSeconds = 0;
    }

    beat() {
      if (this.elapsedSeconds >= this.targetSeconds) {
        this.onAdvanceScene();
      }
    }

    setFrame(frame) {
      this.elapsedSeconds = frame / 60;
    }
  }

  class ExactBeatSceneAdvancer {
    constructor(beats, onAdvanceScene) {
      this.targetBeats = beats;
      this.onAdvanceScene = onAdvanceScene;
    }

    reset() {
      this.elapsedBeats = 0;
    }

    beat() {
      this.elapsedBeats++;

      if (this.elapsedBeats === this.targetBeats) {
        this.onAdvanceScene();
      }
    }

    setFrame() {}
  }

  /* Blenders */

  class OverlayBlender {
    beforeDraw(ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  class ZoomBlender {
    constructor(factor) {
      this.factor = factor;
    }

    beforeDraw(ctx) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      const zoom = beat * this.factor / 100;

      ctx.clearRect(0, 0, w, h);
      ctx.translate(-w * zoom / 2, -h * zoom / 2);
      ctx.scale(1 + zoom, 1 + zoom);
    }

    afterDraw(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  class VerticalMirrorBlender {
    constructor(factor) {
      this.factor = factor;
    }

    beforeDraw(ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    draw(ctx, dc) {
      const c = ctx.canvas;
      ctx.drawImage(dc, 0, 0, dc.width / 2, dc.width * 1080 / 1920, 0, 0, c.width / 2, c.height);
      ctx.scale(-1, 1);
      ctx.drawImage(dc, 0, 0, dc.width / 2, dc.width * 1080 / 1920, -c.width / 2, 0, -c.width / 2, c.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  class HorizontalMirrorBlender {
    constructor(factor) {
      this.factor = factor;
    }

    beforeDraw(ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    draw(ctx, dc) {
      const c = ctx.canvas;
      ctx.drawImage(dc, 0, 0, dc.width, dc.width * 1080 / 1920 / 2, 0, 0, c.width, c.height / 2);
      ctx.scale(1, -1);
      ctx.drawImage(dc, 0, 0, dc.width, dc.width * 1080 / 1920 / 2, 0, -c.height / 2, c.width, -c.height / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  // class FadeOutToWhiteBlender {
  //   constructor(factor) {
  //     this.factor = factor;
  //     this.reset();
  //   }

  //   reset() {
  //     this.opacity = 0;
  //   }

  //   beforeDraw(ctx) {
  //     ctx.globalAlpha = this.opacity;
  //     ctx.fillStyle = '#ffffff';
  //     ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  //     if (this.opacity < 1) {
  //       this.opacity += 0.01;
  //     }
  //   }

  //   afterDraw(ctx) {
  //     ctx.globalAlpha = 1;
  //   }
  // }

  // class FadeBlender {
  //   constructor(factor) {
  //     this.factor = factor;
  //     this.reset();
  //   }

  //   reset() {
  //     this.opacity = 0;
  //   }

  //   beforeDraw(ctx) {
  //     ctx.globalAlpha = this.opacity;

  //     if (this.opacity < 1) {
  //       this.opacity += 0.01;
  //     }
  //   }

  //   afterDraw(ctx) {
  //     ctx.globalAlpha = 1;
  //   }
  // }

  class WhiteFlashBlender {
    constructor(factor) {
      this.factor = factor;
    }

    beforeDraw(ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    afterDraw(ctx) {
      ctx.globalAlpha = beat;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  class BlackFlashBlender {
    constructor(factor) {
      this.factor = factor;
    }

    beforeDraw(ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    afterDraw(ctx) {
      ctx.globalAlpha = beat;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  const progressFrameAdvancer = new ProgressFrameAdvancer();

  function decodeDemo(s) {
    const tokens = /^\/demo\/v([^/])\/([^/]+)\/([^/]+)\/(.+)$/.exec(s);

    if (!tokens) {
      return null;
    }

    const version = parseFloat(tokens[1]);
    const loaderDweetId = parseInt(tokens[2], 10);
    const timelineStr = tokens[3];
    const trackUrl = tokens[4];

    if (version !== 1) {
      return null;
    }

    const loaderScene = {
      dweetId: loaderDweetId,
      sceneAdvancer: new StubSceneAdvancer(),
      frameAdvancer: progressFrameAdvancer,
      blender: new OverlayBlender()
    };

    const timeline = timelineStr
      .split(',')
      .map((s) => {
        const tokens = /^(\d+)(?:([@~!])(\d+))?(?:([tT])(\d+)?)?(?:([zvhwb])(\d+)?)?(=)?/.exec(s);

        if (tokens) {
          const dweetId = tokens[1];
          const sceneAdvancerType = tokens[2] || '~';
          const sceneAdvancerFactor = parseFloat(tokens[3] || '5');
          const frameAdvancerType = tokens[4] || 'm';
          const frameAdvancerFactor = parseFloat(tokens[5] || '5');
          const blenderType = tokens[6] || 'o';
          const blenderFactor = parseFloat(tokens[7] || '5');
          const isContinuous = !!tokens[8];

          const SceneAdvancer = {
            '@': ExactTimeSceneAdvancer,
            '!': ExactBeatSceneAdvancer
          }[sceneAdvancerType] || ApproxTimeSceneAdvancer;

          const sceneAdvancer = new SceneAdvancer(sceneAdvancerFactor, advanceToNextScene);

          const FrameAdvancer = {
            't': BeatRushFrameAdvancer,
            'T': BeatBounceFrameAdvancer
          }[frameAdvancerType] || MonotonousFrameAdvancer;

          const frameAdvancer = new FrameAdvancer(frameAdvancerFactor);

          const Blender = {
            'z': ZoomBlender,
            'v': VerticalMirrorBlender,
            'h': HorizontalMirrorBlender,
            'w': WhiteFlashBlender,
            'b': BlackFlashBlender
          }[blenderType] || OverlayBlender;

          const blender = new Blender(blenderFactor);

          return {
            dweetId,
            sceneAdvancer,
            frameAdvancer,
            blender,
            isContinuous
          };
        } else {
          console.error('Invalid scene', s);
          return null;
        }
      });

    return {
      loaderScene,
      timeline,
      trackUrl
    };
  }

  let demo = null;

  if (location.pathname !== '/') {
    demo = decodeDemo(location.pathname);

    if (!demo) {
      console.warn('Could not decode demo', location.pathname);
    }
  }

  if (!demo) {
    demo = decodeDemo(defaultDemoStr);
    history.replaceState({}, '', defaultDemoStr);
  }

  if (isNaN(demo.loaderScene.dweetId)) {
    demo.loaderScene.dweetId = getRandomLoaderDweetId();
  }

  function getUniqueDweetIdsFromTimeline(timeline) {
    return Object.keys(
      demo.timeline.reduce((idMap, scene) => {
        idMap[scene.dweetId] = 1;
        return idMap;
      }, {})
    );
  }

  let beat = 0;

  function beatHandler() {
    activeScene.sceneAdvancer.beat();
  }

  let dweets = {};
  let activeSceneIdx = 0;
  let activeScene = null;
  let activeTrack = null;
  let activeDweet = null;

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

      const frame = activeScene.frameAdvancer.getFrame();

      activeDweet.setFrame(frame);

      try {
        activeDweet.render();
      } catch (e) {
        console.error(e);
      }

      const blender = activeScene.blender;

      blender.beforeDraw && blender.beforeDraw(ctx);

      const dc = activeDweet.canvas;

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

      activeScene.sceneAdvancer.setFrame(frame);
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

  function setActiveTrack(track) {
    return activeTrack = track;
  }

  function setActiveDweet(dweet) {
    showDweetInfo(dweet);
    return activeDweet = dweet;
  }

  function fetchTrack(url) {
    return $.ajax(`/api/tracks/${encodeURIComponent(url)}`, { dataType: 'json' });
  }

  function fetchDweet(id) {
    return $.ajax(`/api/dweets/${id}`, { dataType: 'json' })
      .then(createRuntime)
      .then((dweet) => dweets[id] = dweet);

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

  function setActiveScene(scene) {
    activeScene = scene;

    activeScene.sceneAdvancer.reset();

    if (!activeScene.isContinuous) {
      activeScene.frameAdvancer.reset();
    }

    activeScene.blender.reset && activeScene.blender.reset();

    setActiveDweet(dweets[activeScene.dweetId]);
  }

  function setActiveSceneByIdx(idx) {
    activeSceneIdx = idx;
    setActiveScene(demo.timeline[idx]);
  }

  function advanceToNextScene() {
    setActiveSceneByIdx((activeSceneIdx + 1) % demo.timeline.length);
  }

  class TaskManager {
    constructor(onUpdateProgress) {
      this.total = 0;
      this.pending = 0;
      this.taskList = [];
      this.onUpdateProgress = onUpdateProgress;
    }

    add(task) {
      this.total++;
      this.pending++;

      this.taskList.push(task);

      return task
        .then((result) => {
          this.onUpdateProgress(--this.pending, this.total);
          return result;
        });
    }

    whenDone() {
      return Promise.all(this.taskList);
    }
  }

  const taskManager = new TaskManager((pending, total) => progressFrameAdvancer.updateProgress(pending, total));

  fetchDweet(demo.loaderScene.dweetId)
    .then(() => setActiveScene(demo.loaderScene))
    .then(() => {
      taskManager.add(getCanvas()
        .then(setupRendering)
        .then(setupUi)
        .then(() => showDweetInfo(activeDweet))
      );

      taskManager.add(fetchTrack(demo.trackUrl)
        .then(setActiveTrack)
        .then((track) => fetchAudio(track.audioUrl))
        .then(setupAudio)
      );

      getUniqueDweetIdsFromTimeline(demo.timeline)
        .forEach((dweetId) => taskManager.add(fetchDweet(dweetId)));

      taskManager.whenDone()
        .then(() => pause(1000))
        .then(() => {
          showTrackInfo(activeTrack);
          startAudio();
          setActiveSceneByIdx(0);
          //blender = fadeOutToWhiteBlender.reset();

          //return pause(5000);
        });
        //.then(() => advanceToNextScene());
    });
})();
