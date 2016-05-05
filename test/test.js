var expect = require('expect.js');
var ShareDBMingo = require('../index');
var makeSortedQuery = require('../make-sorted-query');

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

describe('makeSortedQuery', function() {
  it('basic', function() {
    expect(makeSortedQuery({foo: 2}, []))
      .eql({foo: 2});
    expect(makeSortedQuery({foo: 2}, [['foo', -1]]))
      .eql({foo: 2, $sort: {foo: -1}});
    expect(makeSortedQuery({foo: 2}, [['foo', 1], ['bar', -1]]))
      .eql({foo: 2, $sort: {foo: 1, bar: -1}});
  })
});
