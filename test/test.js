var expect = require('expect.js');
var MemoryDB = require('sharedb/lib/db/memory');
var ShareDBMingo = require('../index').extendMemoryDB(MemoryDB);

function create(callback) {
  var db = ShareDBMingo();
  callback(null, db);
}

require('sharedb/test/db')(create);

describe('db', function() {
  beforeEach(function() {
    this.db = new ShareDBMingo();
  });

  describe('query', function() {
    require('./query')();
  });
});

