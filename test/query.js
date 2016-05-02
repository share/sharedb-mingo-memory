var expect = require('expect.js');

// Call this function inside a `describe` block. Assumes that
// `this.db` is set to be a ShareDB instance that supports certain
// Mongo queries.
module.exports = function() {
  it('$count should count documents', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1, y: 1}},
      {type: 'json0', v: 1, data: {x: 2, y: 2}},
      {type: 'json0', v: 1, data: {x: 3, y: 2}}
    ];
    var db = this.db;
    db.commit('testcollection', 'test1', {v: 0, create: {}}, snapshots[0], function(err) {
      db.commit('testcollection', 'test2', {v: 0, create: {}}, snapshots[1], function(err) {
        db.commit('testcollection', 'test3', {v: 0, create: {}}, snapshots[2], function(err) {
          var query = {$count: true, $query: {y: 2}};
          db.query('testcollection', query, null, null, function(err, results, extra) {
            if (err) throw err;
            expect(results).eql([]);
            expect(extra).eql(2);
            done();
          });
        });
      });
    });
  });

  it('$orderby, $skip and $limit should order, skip and limit', function(done) {
    var snapshots = [
      {type: 'json0', v: 1, data: {x: 1}, id: "test1"},
      {type: 'json0', v: 1, data: {x: 3}, id: "test2"}, // intentionally added out of sort order
      {type: 'json0', v: 1, data: {x: 2}, id: "test3"}
    ];
    var db = this.db;
    db.commit('testcollection', 'test1', {v: 0, create: {}}, snapshots[0], function(err) {
      db.commit('testcollection', 'test2', {v: 0, create: {}}, snapshots[1], function(err) {
        db.commit('testcollection', 'test3', {v: 0, create: {}}, snapshots[2], function(err) {
          var query = {$orderby: {x: 1}, $skip: 1, $limit: 1};
          db.query('testcollection', query, null, null, function(err, results, extra) {
            if (err) throw err;
            expect(results).eql([snapshots[2]]);
            done();
          });
        });
      });
    });
  });

};
