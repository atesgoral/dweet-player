const express = require('express');
const request = require('request-promise-native');
const cheerio = require('cheerio');
const esprima = require('esprima');
const estraverse = require('estraverse');

const app = express();

app.get('/api/dweets/:id', (req, res, next) => {
  const id = req.params.id;

  request(`https://dweet.dwitter.net/id/${id}`)
    .then((response) => {
      // @todo error checking
      const $ = cheerio.load(response);
      // @todo the following probably overkill when a simple RegExp could suffice
      const script = $('body script').html();
      const ast = esprima.parseScript(script, { range: true });

      let u = null;

      estraverse.traverse(ast, {
        enter: function (node) {
          if (node.type === 'FunctionDeclaration' && node.id && node.id.name === 'u') {
            u = script.slice.apply(script, node.range);
            this.break();
          }
        }
      });

      if (u) {
        res.type('application/javascript');
        res.send(u);
      } else {
        // @todo
      }
    })
    .catch(next);
});

app.use(express.static('./src/static'));

const port = parseInt(process.env.port || 7890, 10);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
