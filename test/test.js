var expect = require('chai').expect;
var ShareDBMingo = require('../index');
var getQuery = require('../get-query');

function create(callback) {
  var db = new ShareDBMingo();
  callback(null, db);
}

require('sharedb/test/db')({create: create, getQuery: getQuery});

describe('db', function() {
  beforeEach(function() {
    this.db = new ShareDBMingo();
  });

  describe('query', function() {
    require('./query')();

    it('unsupported', function() {
      this.db.query('testcollection', {$mapReduce: []}, null, null, function(err) {
        expect(err).an('error');
      });
    });
  });
});

describe('getQuery', function() {
  it('basic', function() {
    expect(getQuery({query: {foo: 2}, sort: []}))
      .eql({foo: 2});
    expect(getQuery({query: {foo: 2}, sort: [['foo', -1]]}))
      .eql({foo: 2, $sort: {foo: -1}});
    expect(getQuery({query: {foo: 2}, sort: [['foo', 1], ['bar', -1]]}))
      .eql({foo: 2, $sort: {foo: 1, bar: -1}});
  });
});
