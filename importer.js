#!/usr/bin/env node

const mysql = require('mysql'),
      fs = require('fs'),
      td = require('turndown'),
      slugify = require('slugify');

const turndownService = new td({ codeBlockStyle: 'fenced' })
                        .keep(['iframe', 'script', 'style']);

const conn = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "WNV"
});

const generateFrontMatter = (blag) => {
  dateStr = toFullDateString(new Date(blag.posted * 1000));
  return `---
layout: post
guid: ${blag.guid}
published: ${blag.alive === 1? 'true' : 'false'}
date: ${dateStr}
author: "${blag.author}"
title: "${blag.title}"
tagline: "${blag.headline.replace(/[\\$'"]/g, "\\$&")}"
category: "${blag.category}"
tags: [blag, https, ssl, alonso, homelab, plex, let's encrypt, certbot]
comments: true
image:
  feature: blah.jpg
---

`;
}

conn.connect(function(err) {
  if (err) throw err;
  console.info("Connected");

  conn.query("SELECT * FROM Blag", function (err, result, fields) {
    if (err) throw err;
    console.info(`Fetched ${result.length} entries from Blag`);

    conn.destroy();
    console.info('Destroyed connection');

    for (var i = result.length - 1; i >= 0; i--) {
      createPostFile(result[i]);
    }
  });
});

const toDateString = (dateObj) => {
  return dateObj.getFullYear() + '-' +
         ('0' + (dateObj.getMonth() + 1)).slice(-2) + '-' +
         ('0' + dateObj.getDate()).slice(-2);
}

const toFullDateString = (dateObj) => {
  return toDateString(dateObj) + ' ' +
         ('0' + (dateObj.getHours() + 1)).slice(-2) + ':' +
         ('0' + (dateObj.getMinutes() + 1)).slice(-2) + ':' +
         ('0' + (dateObj.getSeconds() + 1)).slice(-2) + ' ' +
         // we are making some real assumptions about the timezone
         '-0' + (dateObj.getTimezoneOffset() / 60) + '00';
}

const createPostFile = (blag) => {
  const time = new Date(blag.posted * 1000),
        sluggedTitle = slugify(blag.title, {lower: true, remove: /[*+~.,#?/()'"!:@]/g}),
        fileName = `./posts/${toDateString(time)}-${sluggedTitle}-${blag.guid}.md`;

  let post = generateFrontMatter(blag) + turndownService.turndown(blag.content);

  fs.writeFile(fileName, post, () => {
    console.log(`Wrote ${fileName}`);
  });
}