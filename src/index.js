const express = require('express');
const request = require('request-promise-native');
const cheerio = require('cheerio');

const app = express();

const dweetCache = {};

app.get('/api/dweets/:id', (req, res, next) => {
  const id = parseInt(req.params.id, 10);

  let dweet = dweetCache[id];

  if (dweet) {
    res.json(dweet);
  } else {
    request(`https://www.dwitter.net/d/${id}`)
      .then((response) => {
        const $ = cheerio.load(response);
        const author = $('.dweet-author a').text();
        const src = $('.code-input').val();

        dweet = {
          id,
          author,
          src
        };

        dweetCache[id] = dweet;

        res.json(dweet);
      })
      .catch(next);
  }
});

app.use(express.static('./src/static'));

const port = parseInt(process.env.port || 7890, 10);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
