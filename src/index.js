require('dotenv').config();

const express = require('express');
const request = require('request-promise-native');
const cheerio = require('cheerio');

const app = express();

const cacheMaxAge = 60 * 60 * 24; // 1 day

const fmaApiKey = process.env.FMA_API_KEY;

function getCcLicenseTitleFromUrl(url) {
  const tokens = /https?:\/\/creativecommons.org\/licenses\/([^/]+)\/([^/]+)/.exec(url);

  return tokens && `CC ${tokens[1].toUpperCase().replace(/-/g, ' ')} ${tokens[2]}`;
}

app.get('/api/dweets/:id', (req, res, next) => {
  const id = parseInt(req.params.id, 10);

  request(`https://www.dwitter.net/d/${id}`)
    .then((response) => {
      const $ = cheerio.load(response);
      const author = $('.dweet-author a').text();
      const src = $('.code-input').val();

      dweet = {
        id,
        dweetUrl: `https://www.dwitter.net/d/${id}`,
        author,
        authorUrl: `https://www.dwitter.net/u/${author}`,
        src,
        length: src.length
      };

      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      res.json(dweet);
    })
    .catch(next);
});

app.get('/api/tracks/:trackUrl', (req, res, next) => {
  const trackUrl = decodeURIComponent(req.params.trackUrl);

  request(trackUrl)
    .then((response) => {
      const $ = cheerio.load(response);
      const className = $('.play-item').attr('class');
      const tokens = /\btid-(\d+)/.exec(className);

      if (tokens) {
        return tokens[1];
      } else {
        throw new Error('Could not extract track ID');
      }
    })
    .then((trackId) => { // @todo can scrape all this from page, probably
      const dataset = 'tracks';
      const format = 'json';
      const url = `https://freemusicarchive.org/api/get/${dataset}.${format}?api_key=${fmaApiKey}&track_id=${trackId}`;

      return request(url);
    })
    .then(JSON.parse)
    .then((response) => response.dataset[0])
    .then((track) => {
      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      res.json({
        audioUrl: trackUrl + '/download',
        trackTitle: track.track_title,
        trackUrl,
        artistName: track.artist_name,
        artistUrl: track.artist_url,
        licenseTitle: getCcLicenseTitleFromUrl(track.license_url) || track.license_title,
        licenseUrl: track.license_url
      });
    })
    .catch(next);
});

app.get('/api/proxy/:url', (req, res, next) => {
  const url = decodeURIComponent(req.params.url);
  const options = {
    url,
    encoding: null
  };

  // @todo stream?
  request(options)
    .then((response) => {
      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      //res.set('Content-Type', res.headers['Content-Type']);
      res.send(response);
    })
    .catch(next);
});

app.use(express.static('./src/static'));

app.get('/demo/*', (req, res, next) => {
  res.sendFile('index.html', {
    root: __dirname + '/static'
  });
});

const port = parseInt(process.env.PORT || 7890, 10);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
