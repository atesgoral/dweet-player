const express = require('express');
const request = require('request-promise-native');
const cheerio = require('cheerio');

const app = express();

app.get('/api/dweets/:id', (req, res, next) => {
  const id = req.params.id;

  request(`https://www.dwitter.net/d/${id}`)
    .then((response) => {
      // @todo error checking
      const $ = cheerio.load(response);
      const author = $('.dweet-author a').text();
      const src = $('.code-input').val();

      res.json({
        id,
        author,
        src
      });
    })
    .catch(next);
});

app.use(express.static('./src/static'));

const port = parseInt(process.env.port || 7890, 10);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
