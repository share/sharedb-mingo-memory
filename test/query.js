var expect = require('chai').expect;
var async = require('async');

var sortSnapshot = function(snapshots) {
  return snapshots.sort(function (a, b) {
    return (a.id > b.id) ? 1 : ((b.id > a.id) ? -1 : 0);
  });
}

// Call this function inside a `describe` block. Assumes that
// `this.db` is set to be a ShareDB instance that supports certain
// Mongo queries.
module.exports = function() {
  it('$count should count documents', function(done) {
    var snapshots = [
      {type: 'json0', id: 'test1', v: 1, data: {x: 1, y: 1}},
      {type: 'json0', id: 'test2', v: 1, data: {x: 2, y: 2}},
      {type: 'json0', id: 'test3', v: 1, data: {x: 3, y: 2}}
    ];
    var query = {$count: true, y: 2};

    var db = this.db;
    async.each(snapshots, function(snapshot, cb) {
      db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, null, cb);
    }, function(err) {
      if (err) return done(err);
      db.query('testcollection', query, null, null, function(err, results, extra) {
        if (err) return done(err);

        expect(results).eql([]);
        expect(extra).eql(2);
        done();
      });
    });
  });

  it('$sort, $skip and $limit should order, skip and limit', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1}, id: "test1", m: null},
      {type: 'json0', v: 1, data: {x: 3}, id: "test2", m: null}, // intentionally added out of sort order
      {type: 'json0', v: 1, data: {x: 2}, id: "test3", m: null}
    ];
    var query = {$sort: {x: 1}, $skip: 1, $limit: 1};

    var db = this.db;
    async.each(snapshots, function(snapshot, cb) {
      db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, null, cb);
    }, function(err) {
      if (err) return done(err);

      db.query('testcollection', query, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshots[2]]);
        done();
      });
    });
  });

  describe('filtering on special Share properties', function() {
    // When sharedb-mongo persists a snapshot into Mongo, any properties
    // underneath `data` get "promoted" to top-level, and Share properties
    // get underscore-prefixed to avoid name conflicts, like `v` to `_v`.
    //
    // Query conditions don't undergo this transformation, so if you wanted
    // to filter on snapshot version, you'd query with `{_v: 12}`. These tests
    // check that sharedb-mingo-memory is consistent with sharedb-mongo for
    // queries like those that filter on non-data Share properties.
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1, y: 1}, id: "test1", m: {mtime: 1000}},
      {type: 'json0', v: 1, data: {x: 1, y: 2}, id: "test2", m: {mtime: 1001}},
      {type: 'json0', v: 1, data: {x: 2, y: 2}, id: "test3", m: {mtime: 1002}}
    ];
    var snapshotsNoMeta = snapshots.map(function(snapshot) {
      var snapshotCopy = JSON.parse(JSON.stringify(snapshot));
      snapshotCopy.m = null;
      return snapshotCopy;
    });

    beforeEach(function(done) {
      var db = this.db;
      async.each(snapshots, function(snapshot, cb) {
        db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, null, cb);
      }, done);
    });

    it('condition on Mongo _id (Share id)', function(done) {
      this.db.query('testcollection', {_id: 'test1'}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshotsNoMeta[0]]);
        done();
      });
    });

    it('condition on sub-property under Share metadata', function(done) {
      this.db.query('testcollection', {'_m.mtime': 1001}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshotsNoMeta[1]]);
        done();
      });
    });

    it('condition on Mongo _id and Share data', function(done) {
      this.db.query('testcollection', {y: 2, _id: {$nin: ['test2']}}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshotsNoMeta[2]]);
        done();
      });
    });

    it('top-level boolean operator', function(done) {
      this.db.query('testcollection', {$or: [{y: 1}, {_id: 'test2'}]}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(sortSnapshot(results)).eql(sortSnapshot([snapshotsNoMeta[0], snapshotsNoMeta[1]]));
        done();
      });
    });
  });

  it('filters with null condition', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1, y: 1}, id: "test1", m: null},
      {type: 'json0', v: 1, data: {x: 1}, id: "test2", m: null}, // y value intentionally omitted
      {type: 'json0', v: 1, data: {x: 2, y: 2}, id: "test3", m: null}
    ];
    var query = {y: null};

    var db = this.db;
    async.each(snapshots, function(snapshot, cb) {
      db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, null, cb);
    }, function(err) {
      if (err) return done(err);

      db.query('testcollection', query, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshots[1]]);
        done();
      });
    });
  });

  describe('top-level boolean operator', function() {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1, y: 1}, id: "test1", m: null},
      {type: 'json0', v: 1, data: {x: 1, y: 2}, id: "test2", m: null},
      {type: 'json0', v: 1, data: {x: 2, y: 2}, id: "test3", m: null}
    ];

    beforeEach(function(done) {
      var db = this.db;
      async.each(snapshots, function(snapshot, cb) {
        db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, null, cb);
      }, done);
    });

    it('$and', function(done) {
      this.db.query('testcollection', {$and: [{x: 1}, {y: 1}], $sort: {_id: 1}}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshots[0]]);
        done();
      });
    });

    it('$or', function(done) {
      this.db.query('testcollection', {$or: [{x: 1}, {y: 1}], $sort: {_id: 1}}, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(sortSnapshot(results)).eql(sortSnapshot([snapshots[0], snapshots[1]]));
        done();
      });
    });
  });
};
