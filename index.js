var Mingo = require('mingo');
var cloneDeep = require('lodash.clonedeep');
var isObject = require('lodash.isobject');
var sharedbMongoUtils = require('./sharedb-mongo-utils');
var util = require('sharedb/lib/util');

// This is designed for use in tests, so load all Mingo query operators
require('mingo/init/system');

// Snapshot properties added to the root doc by `castToDoc()` in sharedb-mongo
var MONGO_DOC_PROPERTIES = {
  _id: 'id',
  _v: 'v',
  _type: 'type',
  _m: 'm',
  _o: 'o'
};

// Query keys to strip, because Mingo doesn't already ignore them.
var STRIPPED_QUERY_KEYS = {
  $comment: true,
  $hint: true
};

function extendMemoryDB(MemoryDB) {
  function ShareDBMingo(options) {
    if (!(this instanceof ShareDBMingo)) return new ShareDBMingo(options);
    MemoryDB.call(this, options);
  }

  ShareDBMingo.prototype = Object.create(MemoryDB.prototype);

  ShareDBMingo.prototype._writeSnapshotSync = function(collection, id, snapshot) {
    var collectionDocs = this.docs[collection] || (this.docs[collection] = {});
    // The base MemoryDB deletes the `collectionDocs` entry when `snapshot.type == null`. However,
    // sharedb-mongo leaves behind stub Mongo docs that preserve `snapshot.m` metadata. To match
    // that behavior, just set the new snapshot instead of deleting the entry.
    //
    // For queries, the "tombstones" left over from deleted docs get filtered out by makeQuerySafe.
    collectionDocs[id] = cloneDeep(snapshot);
  };

  ShareDBMingo.prototype.query = function(collection, query, fields, options, callback) {
    var includeMetadata = options && options.metadata;
    var db = this;
    if (typeof callback !== 'function') throw new Error('Callback required');
    util.nextTick(function() {
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
          result.snapshots.forEach(function(snapshot) {
            snapshot.m = null;
          });
        }
        callback(null, result.snapshots, result.extra);
      } catch (err) {
        callback(err);
      }
    });
  };

  ShareDBMingo.prototype._querySync = function(snapshots, query, _options) {
    if (Array.isArray(query.$aggregate)) {
      // sharedb-mongo passes the $aggregate pipeline straight to Mongo, so
      // convert Snapshot instances to Mongo doc format for Mingo to operate on.
      var mongoDocs = snapshots.map(castToMongoDoc);
      var mingoAgg = new Mingo.Aggregator(query.$aggregate);
      var aggResult = mingoAgg.run(mongoDocs);
      return {snapshots: [], extra: aggResult};
    }

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
    var includeMetadata = options && options.metadata;
    var db = this;
    if (typeof callback !== 'function') throw new Error('Callback required');
    util.nextTick(function() {
      try {
        var mingoQuery = new Mingo.Query(castToSnapshotQuery(query));
        var snapshot = db._getSnapshotSync(collection, id, includeMetadata);
        if (snapshot.data) {
          callback(null, mingoQuery.test(snapshot));
        } else {
          callback(null, false);
        }
      } catch (err) {
        callback(err);
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
    var query = cloneDeep(inputQuery);

    if (inputQuery.$orderby) {
      console.warn('Warning: query.$orderby deprecated. Use query.$sort instead.');
    }
    var sort = query.$sort || query.$orderby;
    delete query.$sort;
    delete query.$orderby;

    var skip = query.$skip;
    delete query.$skip;

    var limit = query.$limit;
    delete query.$limit;

    var count = query.$count;
    delete query.$count;

    // If needed, modify query to exclude "tombstones" left after deleting docs, using the same
    // approach that sharedb-mongo uses.
    sharedbMongoUtils.makeQuerySafe(query);

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
    if (!isObject(query) || Array.isArray(query)) {
      throw new Error('Invalid mongo query format');
    }

    var snapshotQuery = {};
    var propertySegments;
    for (var property in query) {
      // Ignore $-prefixed keys like $comment and $hint that aren't already
      // ignored by Mingo. sharedb-mongo would normally map them to cursor calls.
      if (STRIPPED_QUERY_KEYS[property]) {
        continue;
      }

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
        snapshotQuery['data.' + property] = query[property];
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

  /** Casts the Snapshot into a Mongo document object */
  function castToMongoDoc(snapshot) {
    var doc = Object.assign({}, snapshot.data);
    doc._id = snapshot.id;
    doc._type = snapshot.type;
    doc._v = snapshot.v;
    doc._m = snapshot.m;
    return doc;
  }

  return ShareDBMingo;
}

ShareDBMingo = extendMemoryDB(require('sharedb').MemoryDB);
ShareDBMingo.extendMemoryDB = extendMemoryDB;

module.exports = ShareDBMingo;
