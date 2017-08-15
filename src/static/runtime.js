function getRenderer() {
  var $ = undefined;

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

  eval(`var u = ${arguments[0]}`);

  return {
    canvas: c,
    setFrame: function (f) {
      frame = f;
      time = frame / 60;

      if (time * 60 | 0 == frame - 1) {
        time += 0.000001;
      }
    },
    render: function () {
      u(time);
    }
  };
}

const renderProgress = function u(t) {
  x.beginPath();
  x.arc(c.width / 2, c.height / 2, c.height / 3, 0, 2 * Math.PI * -t, true);
  x.lineCap = 'round';
  x.lineWidth = c.height / 20;
  x.stroke();
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

$(function () {
  let renderer = getRenderer(renderProgress.toString());
  let frameAdvancer = progressFrameAdvancer;

  const canvas = $("#c").get(0);

  canvas.width = 1920;
  canvas.height = 1080;

  const ctx = canvas.getContext('2d');

  function render() {
    requestAnimationFrame(render);

    //const renderer = renderers[(frameCount / 100 | 0) % renderers.length];

    renderer.setFrame(frameAdvancer.getFrame());

    try {
      renderer.render();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        renderer.canvas,
        0, 0, renderer.canvas.width, renderer.canvas.width * 1080 / 1920,
        0, 0, canvas.width, canvas.height
      );
    } catch (e) {
      console.error(e);
    }
  }

  render();

  let topDweetIds = [ 701, 888, 1231, 739, 933, 676, 855, 683, 1829, 697, 433, 135 ];

  let dweetRenderers = [];
  let pending = 0;

  function progress(renderer) {
    progressFrameAdvancer.updateProgress(--pending, fetches.length);
    return renderer;
  }

  const fetches = topDweetIds
    .sort(function () { return Math.random() - 0.5; })
    .slice(0, 3)
    .map(function (id, idx) {
      return $.ajax(`/api/dweets/${id}`, { dataType: 'text' })
        .then(getRenderer)
        .then(progress);
    });

  pending = fetches.length;

  Promise.all(fetches)
    .then(function (_dweetRenderers) {
      dweetRenderers = _dweetRenderers;

      setTimeout(function () {
        frameAdvancer = monotonousFrameAdvancer;
        renderer = dweetRenderers[0];
      }, 1000);
    });
});
