module.exports = {
  mysql: {
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "WNV"
  },

  markdown: {
    options: { 
      codeBlockStyle: 'fenced' 
    },
    keepTags: ['iframe', 'script', 'style'],
    preserveAttrs: ['class', 'style']
  },

  paths: {
    postsOutDir: './posts'
  },

  blacklist: ['123-bad-post'],

  transforms: [
    ['FART', 'LOUD BUTT ANNOUNCEMENT', 'g'],
    ['giraffe', 'Tall Horse', 'i']
  ],

  includeDrafts: false
};