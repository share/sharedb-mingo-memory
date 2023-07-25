var expect = require('chai').expect;
var ShareBackend = require('sharedb');
var sinon = require('sinon');
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
  afterEach(function() {
    sinon.restore();
  });

  describe('query', function() {
    require('./query')();

    it('unsupported', function() {
      this.db.query('testcollection', {$mapReduce: []}, null, null, function(err) {
        expect(err).an('error');
      });
    });
  });

  it('preserves doc metadata after deletion', function(done) {
    var clock = sinon.useFakeTimers(1000000);
    function expectMeta(property, value) {
      var snapshot = db._getSnapshotSync('testcollection', 'test1', true);
      expect(snapshot).to.have.property('m');
      expect(snapshot.m).to.have.property(property, value);
    }
    var db = this.db;
    var backend = new ShareBackend({db: db});
    var connection = backend.connect();
    var doc = connection.get('testcollection', 'test1');
    doc.create({x: 1, y: 1}, function(err) {
      if (err) return done(err);
      expect(doc).to.have.property('version', 1);
      expectMeta('ctime', 1000000);
      expectMeta('mtime', 1000000);

      clock.tick(1000);
      doc.del(function(err) {
        if (err) return done(err);
        expect(doc).to.have.property('type', null);
        expect(doc).to.have.property('data', undefined);
        expect(doc).to.have.property('version', 2);
        expectMeta('ctime', 1000000);
        expectMeta('mtime', 1001000);
        done();
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
