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

    it('unsupported', function() {
      this.db.query('testcollection', {$mapReduce: []}, null, null, function(err, results) {
        expect(err).ok();
        expect(err.message).match(/Unsupported/);
      });
    });
  });
});

