#!/usr/bin/env node

// import
const config = require('./config');
const cheerio = require('cheerio'),
      mysql = require('promise-mysql'),
      fs = require('fs'),
      slugify = require('slugify'),
      td = require('turndown');

// constants
const fetchAllQuery = `SELECT 
  User.username AS 'author', 
  BlagCategory.name AS 'category', 
  Blag.guid AS 'guid', 
  Blag.posted AS 'posted', 
  Blag.alive AS 'alive', 
  Blag.title AS 'title', 
  Blag.headline AS 'headline', 
  Blag.content AS 'content' 
FROM 
  Blag 
    LEFT JOIN 
      User ON User.guid = Blag.author  
    LEFT JOIN 
      BlagCategory ON BlagCategory.guid = Blag.category`;

const getTagsForPostQuery = (guid) => `SELECT
  Curator.name AS 'tagName'
FROM
  Curator,
  CuratorRelation,
  Blag
WHERE
  Blag.guid = '${guid}' AND
  CuratorRelation.target = Blag.guid AND
  Curator.guid = CuratorRelation.Curator`;

// setup
const turndownService = new td(config.markdown.options)
        .keep(config.markdown.keepTags)
        .addRule('preserveAttrs', {
          filter: (node) => {
            let attributes = config.markdown.preserveAttrs,
                attrTest = attributes.some(attr => node.hasAttribute(attr)),
                dataTest = Object.keys(node.dataset).length > 0;

            return attrTest || dataTest;
          },
          replacement: (innerHTML, node) => node.outerHTML})

// helper
const generateFrontMatter = (blag) => {
  dateStr = toFullDateString(new Date(blag.posted * 1000));
  return `---
layout: post
guid: ${blag.guid}
published: ${blag.alive === 1? 'true' : 'false'}
date: ${dateStr}
author: ${blag.author}
title: "${blag.title}"
excerpt: "${blag.headline.replace(/[\\$'"]/g, "\\$&")}"
category: ${blag.category}
tags: ${JSON.stringify(blag.tags)}
comments: true ${blag.image === null ? '' : `
image:
  ${blag.imageType}: ${blag.image}${blag.imageHover !== null ? `
  imageHover: "${blag.imageHover}"` : '' }`}
---
`;
}

const generatePost = (blag) => {
  let $post = cheerio.load(blag.content),
      headlinerEl = $post('img.headliner');
  let image = null,
      imageHover = null,
      imageType;

  if(headlinerEl.length > 0){
    image = headlinerEl.attr('src').replace(/^\/+/g, '');
    imageType = blag.category == 'Comics' ? 'feature' : 'headliner';
    imageHover = headlinerEl.attr('title') ? headlinerEl.attr('title') : null;

    let parentGraph = $post('img.headliner').parent('p');
    $post('img.headliner').remove();
    if(!parentGraph.text().trim().length > 0){
      parentGraph.remove();
    }

    blag.content = $post.html();
  }

  blag.image = image;
  blag.imageHover = imageHover;
  blag.imageType = imageType;

  let frontMatter = generateFrontMatter(blag),
      postBody = turndownService.turndown(blag.content);

  return `${frontMatter}
${postBody}`;
}

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
        fileName = `${config.paths.postsOutDir}/${toDateString(time)}-${sluggedTitle}-${blag.guid}.md`;

  let post = generatePost(blag);

  fs.writeFile(fileName, post, () => {
    console.info(`Wrote ${fileName}`);
  });
}


// main, i guess? what's that in node?
// if i wanted to to this "right" i'd export a method but whatever
let connection,
    posts;

mysql.createConnection(config.mysql).then((conn) => {
  console.info("Connected");
  connection = conn;

  return connection.query(fetchAllQuery);
}).then( async (result) => {
  console.info(`Fetched ${result.length} entries from Blag`);
  posts = result;

  for(var i = posts.length - 1; i >= 0; i--){
    const guid = posts[i].guid;

    tagsResult = await connection.query(getTagsForPostQuery(guid));
    console.info(`Fetched ${tagsResult.length} tags for ${guid}`);

    let tags = tagsResult.reduce((acc, val) => {
      acc.push(val.tagName);
      return acc;
    }, []);

    posts[i].tags = tags;
  }
  return posts;
}).then((result) => {
  for(var i = result.length - 1; i >= 0; i--){
    createPostFile(result[i]);
  }

  connection.end();
  console.info("Closed connection");
}).catch((err) => {
    if(connection && connection.end){
      connection.end();
    }
    console.error(err);
});