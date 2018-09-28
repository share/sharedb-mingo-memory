var Mingo = require('mingo');

// Snapshot properties added to the root doc by `castToDoc()` in sharedb-mongo
var MONGO_DOC_PROPERTIES = {
  '_id': 'id',
  '_v': 'v',
  '_type': 'type',
  '_m': 'm',
  '_o': 'o'
};

function extendMemoryDB(MemoryDB) {
  function ShareDBMingo(options) {
    if (!(this instanceof ShareDBMingo)) return new ShareDBMingo(options);
    MemoryDB.call(this, options);
  }

  ShareDBMingo.prototype = Object.create(MemoryDB.prototype);

  ShareDBMingo.prototype.query = function(collection, query, fields, options, callback) {
    var includeMetadata = options && options.metadata;
    var db = this;
    if (typeof callback !== 'function') throw new Error('Callback required');
    process.nextTick(function() {
      var collectionDocs = db.docs[collection];
      var snapshots = [];
      // Include metadata for the snapshots we are about to query, so the metadata
      // can be used to filter the results
      var includeMetadataForQuery = true;
      for (var id in collectionDocs || {}) {
        var snapshot = db._getSnapshotSync(collection, id, includeMetadataForQuery);
        snapshots.push(snapshot);
      }
      try {
        var result = db._querySync(snapshots, query, options);
        // If metadata was not explicitly defined in the original options, we want
        // to remove the metadata from the snapshots to match ShareDB's behavior
        if (result.snapshots && !includeMetadata) {
          result.snapshots.forEach(function(snapshot) { snapshot.m = null; });
        }
        callback(null, result.snapshots, result.extra);
      } catch (err) {
        callback(err);
      }
    });
  };

  ShareDBMingo.prototype._querySync = function(snapshots, query, options) {
    var parsed = parseQuery(query);
    var mingoQuery = new Mingo.Query(castToSnapshotQuery(parsed.query));

    var filtered = snapshots.filter(function(snapshot) {
      return mingoQuery.test(snapshot);
    });
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
    var mingoQuery = new Mingo.Query(castToSnapshotQuery(query));
    this.getSnapshot(collection, id, null, null, function(err, snapshot) {
      if (err) return callback(err);
      if (snapshot.data) {
        callback(null, mingoQuery.test(snapshot));
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

  // Build a query object that mimics how the query would be executed if it were
  // made against snapshots persisted with `sharedb-mongo`
  function castToSnapshotQuery(query) {
    var snapshotQuery = {};
    var propertySegments;
    for (var property in query) {
      propertySegments = property.split('.');

      // Mongo doc property
      if (MONGO_DOC_PROPERTIES[propertySegments[0]]) {
        propertySegments[0] = MONGO_DOC_PROPERTIES[propertySegments[0]];
        snapshotQuery[propertySegments.join('.')] = query[property];

      // top-level boolean operator
      } else if (property[0] === '$' && Array.isArray(query[property])) {
        snapshotQuery[property] = [];
        for (var i = 0; i < query[property].length; i++) {
          snapshotQuery[property].push(castToSnapshotQuery(query[property][i]));
        }

      // nested `data` document
      } else {
        snapshotQuery["data." + property] = query[property];
      }
    }
    return snapshotQuery;
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
