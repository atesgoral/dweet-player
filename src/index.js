require('dotenv').config();

const express = require('express');
const request = require('request-promise-native');
const cheerio = require('cheerio');
const jsmediatags = require('jsmediatags');

const app = express();

const cacheMaxAge = 60 * 60 * 24; // 1 day

const fmaApiKey = process.env.FMA_API_KEY;

function getCcLicenseTitleFromUrl(url) {
  const tokens = /https?:\/\/creativecommons.org\/licenses\/([^/]+)\/([^/]+)/.exec(url);

  return tokens && `CC ${tokens[1].toUpperCase().replace(/-/g, ' ')} ${tokens[2]}`;
}

app.get('/api/dweets/:id', (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const options = {
    uri: `https://www.dwitter.net/api/dweets/${id}`,
    json: true
  };

  request(options)
    .then((response) => {
      const dweet = {
        id,
        dweetUrl: response.link,
        author: response.author.username,
        authorUrl: response.author.link,
        src: response.code,
        length: response.code.length
      };

      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      res.json(dweet);
    })
    .catch(next);
});

function getFmaTrack(trackUrl) {
  return request(trackUrl)
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
    .then((track) => ({
      audioUrl: trackUrl + '/download',
      trackTitle: track.track_title,
      trackUrl,
      artistName: track.artist_name,
      artistUrl: track.artist_url,
      licenseTitle: getCcLicenseTitleFromUrl(track.license_url) || track.license_title,
      licenseUrl: track.license_url
    }));
}

function readId3(mp3Data) {
  return new Promise((resolve, reject) => {
    new jsmediatags.Reader(mp3Data)
      .setTagsToRead([ 'title', 'artist' ])
      .read({
        onSuccess: resolve,
        onError: reject
      });
  });
}

function getMp3Track(trackUrl) {
  const options = {
    url: trackUrl,
    encoding: null
  };

  return request(options)
    .then(readId3)
    .then((id3) => {
      return {
        audioUrl: trackUrl,
        trackTitle: id3.tags.title,
        artistName: id3.tags.artist
      };
    });
}

const trackUrlHandlers = [{
  pattern: /^https?:\/\/freemusicarchive\.org/,
  get: getFmaTrack
}, {
  pattern: /\.mp3$/,
  get: getMp3Track
}];

app.get('/api/tracks/:trackUrl', (req, res, next) => {
  const trackUrl = decodeURIComponent(req.params.trackUrl);
  const handler = trackUrlHandlers.find((handler) => handler.pattern.test(trackUrl));

  if (!handler) {
    next('Unsupported track URL');
  }

  handler
    .get(trackUrl)
    .then((track) => {
      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      res.json(track);
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
