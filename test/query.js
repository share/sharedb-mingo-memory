var expect = require('expect.js');
var async = require('async');
var Backend = require('sharedb').Backend;

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
      db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, cb);
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

  it('$count with createSubscribeQuery', function(done) {
    var connection = new Backend({db: this.db}) .connect();
    async.parallel([
      function(cb) { connection.get('testcollection', 'test1').create({x: 1, y: 1}, cb); },
      function(cb) { connection.get('testcollection', 'test2').create({x: 2, y: 2}, cb); },
      function(cb) { connection.get('testcollection', 'test3').create({x: 3, y: 2}, cb); }
    ], function(err) {
      var query = {$count: true, y: 2};
      if (err) return done(err);
      var query = connection.createSubscribeQuery('testcollection', query, null, function(err, results, extra) {
        if (err) return done(err);

        expect(results).eql([]);
        expect(extra).eql(2);
        connection.get('testcollection', 'test3').submitOp({p: ['y'], na: 1});
      });
      query.on('extra', function(extra) {
        expect(extra).eql(1);
        done();
      });
    });
  });

  it('$sort, $skip and $limit should order, skip and limit', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1}, id: "test1"},
      {type: 'json0', v: 1, data: {x: 3}, id: "test2"}, // intentionally added out of sort order
      {type: 'json0', v: 1, data: {x: 2}, id: "test3"}
    ];
    var query = {$sort: {x: 1}, $skip: 1, $limit: 1};

    var db = this.db;
    async.each(snapshots, function(snapshot, cb) {
      db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, cb);
    }, function(err) {
      if (err) return done(err);

      db.query('testcollection', query, null, null, function(err, results, extra) {
        if (err) throw err;
        expect(results).eql([snapshots[2]]);
        done();
      });
    });
  });

  describe('top-level boolean operator', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1, y: 1}, id: "test1"},
      {type: 'json0', v: 1, data: {x: 1, y: 2}, id: "test2"},
      {type: 'json0', v: 1, data: {x: 2, y: 2}, id: "test3"}
    ];

    beforeEach(function(done) {
      var db = this.db;
      async.each(snapshots, function(snapshot, cb) {
        db.commit('testcollection', snapshot.id, {v: 0, create: {}}, snapshot, cb);
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
        expect(results).eql([snapshots[0], snapshots[1]]);
        done();
      });
    });
  });
};
