require('dotenv').config();

const { SLACK_TOKEN, SLACK_CHANNEL_ID, UNSPLASH_ACCESS_KEY } = process.env;

const getGenreQuote = (genre = "technology") => {
	return new Promise((resolve, reject) => {
		axios.get(`https://quote-garden.herokuapp.com/api/v3/quotes/random?genre=${genre}`).then(({ data }) => {
			resolve(data);
		}).catch(error => {
			reject(error);
		});
	});
}

const { createApi } = require("unsplash-js");

const fs = require("fs");
const http = require("http");
const axios = require("axios");
const nodeFetch = require("node-fetch");

// https://www.npmjs.com/package/unsplash-js#adding-polyfills
global.fetch = nodeFetch;

const cron = require('node-cron');

const FILE_NAME = './image.jpg';

const unsplash = createApi({
	accessKey: UNSPLASH_ACCESS_KEY,
	fetch: nodeFetch
});

const { WebClient } = require('@slack/web-api');

const web = new WebClient(SLACK_TOKEN);

const getImageUrl = (category = "success") => {
	return new Promise((resolve, reject) => {
		unsplash.photos.getRandom({
			query: category,
			count: 1,
		}).then(data => {
			const link = data.response[0].links.download_location;

			unsplash.photos.trackDownload({
				downloadLocation: link
			}).then(res => {
				axios({
					url: res.response.url,
					type: "GET",
					responseType: "stream"
				}).then(res => {
					res.data.pipe(fs.createWriteStream(FILE_NAME.slice(2)));

					resolve(true);
				}).catch(err => console.log(err));
			}).catch(err => reject(err));
		}).catch(err => reject(err));
	});
}

const main = () => {
	getGenreQuote().then(res => {
		const { quoteText:quote, quoteAuthor:author } = res.data[0];

		getImageUrl().then(() => {
			// NEVER USE SUCH HACKY WAYS IN PRODUCTION!
			setTimeout(() => {
				web.files.upload({
					token: SLACK_TOKEN, // unsure if needed or not
					channels: SLACK_CHANNEL_ID,
					title: author,
					initial_comment: quote,
					file: fs.createReadStream(FILE_NAME)
				}).then(resp => {
					console.log(resp);
					fs.unlink(FILE_NAME, err => console.log(err));
				}).catch(err => console.log(`${err}`));
			}, 2500); // AGAIN: NEVER...!
		}).catch(err => console.log(err));
	}).catch(e => console.log(e));
}

cron.schedule('33 2 * * 0,3,6', main);

console.log("Scheduled!");
