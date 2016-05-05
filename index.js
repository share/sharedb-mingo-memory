var Mingo = require('mingo');

function extendMemoryDB(MemoryDB) {
  function ShareDBMingo(options) {
    if (!(this instanceof ShareDBMingo)) return new ShareDBMingo(options);
    MemoryDB.call(this, options);
  }

  ShareDBMingo.prototype = Object.create(MemoryDB.prototype);

  ShareDBMingo.prototype._querySync = function(snapshots, query, options) {
    var query = JSON.parse(JSON.stringify(query));
    var orderby = query.$orderby;
    delete query.$orderby;
    var skip = query.$skip;
    delete query.$skip;
    var limit = query.$limit;
    delete query.$limit;
    var count = query.$count;
    delete query.$count;
    for (var prop in query) {
      if (prop[0] === '$') {
        throw new Error("Unsupported operator: " + prop);
      }
    }

    var filtered = filter(snapshots, query);
    if (orderby) sort(filtered, orderby);
    if (skip) filtered.splice(0, skip);
    if (limit) filtered = filtered.slice(0, limit);
    if (count) {
      return {snapshots: [], extra: filtered.length};
    } else {
      return {snapshots: filtered};
    }
  };

  ShareDBMingo.prototype.queryPollDoc = function(collection, id, query, options, callback) {
    var mingoQuery = new Mingo.Query(query);
    this.getSnapshot(collection, id, null, function(err, snapshot) {
      if (err) return callback(err);
      if (snapshot.data) {
        callback(null, mingoQuery.test(snapshot.data));
      } else {
        callback(null, false);
      }
    });
  };

  ShareDBMingo.prototype.canPollDoc = function(collection, query) {
    return !(
      query.hasOwnProperty('$orderby') ||
        query.hasOwnProperty('$limit') ||
        query.hasOwnProperty('$skip') ||
        query.hasOwnProperty('$count')
    );
  };

  // Support exact key match filters only
  function filter(snapshots, query) {
    var mingoQuery = new Mingo.Query(query);
    return snapshots.filter(function(snapshot) {
      return snapshot.data && mingoQuery.test(snapshot.data);
    });
  }

  // Support sorting with the Mongo $orderby syntax
  function sort(snapshots, orderby) {
    if (!orderby) return snapshots;
    snapshots.sort(function(snapshotA, snapshotB) {
      for (var key in orderby) {
        var value = orderby[key];
        if (value !== 1 && value !== -1) {
          throw new Error('Invalid $orderby value');
        }
        var a = snapshotA.data && snapshotA.data[key];
        var b = snapshotB.data && snapshotB.data[key];
        if (a > b) return value;
        if (b > a) return -value;
      }
      return 0;
    });
  }

  // XXX duplicated in sharedb-mongo; should we extract to
  // sharedb-mongo-utilities?
  //
  // Given a key/value comparison query, return a query object with that
  // filter and a specified sort order. The 'order' argument looks like
  // [['foo', 1], ['bar', -1]] for sort by foo asending, then bar
  // descending
  ShareDBMingo.prototype.makeSortedQuery = function(inputQuery, order) {
    // Convert order to Mongo's expected structure
    if (!Array.isArray(order)) {
      throw new Error("invalid order");
    }
    if (order.length === 0) {
      return inputQuery;
    } else {
      var mongoOrder = {};
      for (var i = 0; i < order.length; i++) {
        if (!Array.isArray(order[i]) || order[i].length !== 2) {
          throw new Error("invalid order");
        }
        mongoOrder[order[i][0]] = order[i][1];
      }
      var query = JSON.parse(JSON.stringify(inputQuery));
      query.$orderby = mongoOrder;
      return query;
    }
  };

  return ShareDBMingo;
}

ShareDBMingo = extendMemoryDB(require('sharedb').MemoryDB);
ShareDBMingo.extendMemoryDB = extendMemoryDB;

module.exports = ShareDBMingo;
