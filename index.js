var Mingo = require('mingo');

function extendMemoryDB(MemoryDB) {
  function ShareDBMingo(options) {
    if (!(this instanceof ShareDBMingo)) return new ShareDBMingo(options);
    MemoryDB.call(this, options);
  }

  ShareDBMingo.prototype = Object.create(MemoryDB.prototype);

  ShareDBMingo.prototype._querySync = function(snapshots, query, options) {
    var parsed = parseQuery(query);

    var filtered = filter(snapshots, parsed.query);
    if (parsed.sort) sort(filtered, parsed.sort);
    if (parsed.skip) filtered.splice(0, parsed.skip);
    if (parsed.limit) filtered = filtered.slice(0, parsed.limit);
    if (parsed.count) {
      return {snapshots: [], extra: filtered.length};
    } else {
      return {snapshots: filtered};
    }
  };

  ShareDBMingo.prototype.queryPollDoc = function(collection, id, query, options, callback) {
    var mingoQuery = new Mingo.Query(query);
    this.getSnapshot(collection, id, null, null, function(err, snapshot) {
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
        query.hasOwnProperty('$sort') ||
        query.hasOwnProperty('$limit') ||
        query.hasOwnProperty('$skip') ||
        query.hasOwnProperty('$count')
    );
  };

  function parseQuery(inputQuery) {
    var query = JSON.parse(JSON.stringify(inputQuery));

    if (inputQuery.$orderby)
      console.warn("Warning: query.$orderby deprecated. Use query.$sort instead.");
    var sort = query.$sort || query.$orderby;
    delete query.$sort;
    delete query.$orderby;

    var skip = query.$skip;
    delete query.$skip;

    var limit = query.$limit;
    delete query.$limit;

    var count = query.$count;
    delete query.$count;

    return {
      query: query,
      sort: sort,
      skip: skip,
      limit: limit,
      count: count
    };
  }

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

  return ShareDBMingo;
}

ShareDBMingo = extendMemoryDB(require('sharedb').MemoryDB);
ShareDBMingo.extendMemoryDB = extendMemoryDB;

module.exports = ShareDBMingo;
