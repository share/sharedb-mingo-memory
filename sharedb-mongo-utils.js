// These functions are taken straight from sharedb-mongo.

exports.makeQuerySafe = makeQuerySafe;

// Call on a query after it gets parsed to make it safe against
// matching deleted documents.
function makeQuerySafe(query) {
  // Don't modify the query if the user explicitly sets _type already
  if (query.hasOwnProperty('_type')) return;
  // Deleted documents are kept around so that we can start their version from
  // the last version if they get recreated. When docs are deleted, their data
  // properties are cleared and _type is set to null. Filter out deleted docs
  // by requiring that _type is a string if the query does not naturally
  // restrict the results with other keys
  if (deletedDocCouldSatisfyQuery(query)) {
    query._type = {$type: 2};
  }
};

// Could a deleted doc (one that contains {_type: null} and no other
// fields) satisfy a query?
//
// Return true if it definitely can, or if we're not sure. (This
// function is used as an optimization to see whether we can avoid
// augmenting the query to ignore deleted documents)
function deletedDocCouldSatisfyQuery(query) {
  // Any query with `{foo: value}` with non-null `value` will never
  // match deleted documents (that are empty other than the `_type`
  // field).
  //
  // This generalizes to additional classes of queries. Here’s a
  // recursive description of queries that can't match a deleted doc:
  // In general, a query with `{foo: X}` can't match a deleted doc
  // if `X` is guaranteed to not match null or undefined. In addition
  // to non-null values, the following clauses are guaranteed to not
  // match null or undefined:
  //
  // * `{$in: [A, B, C]}}` where all of A, B, C are non-null.
  // * `{$ne: null}`
  // * `{$exists: true}`
  // * `{$gt: not null}`, `{gte: not null}`, `{$lt: not null}`, `{$lte: not null}`
  //
  // In addition, some queries that have `$and` or `$or` at the
  // top-level can't match deleted docs:
  // * `{$and: [A, B, C]}`, where at least one of A, B, C are queries
  //   guaranteed to not match `{_type: null}`
  // * `{$or: [A, B, C]}`, where all of A, B, C are queries guaranteed
  //   to not match `{_type: null}`
  //
  // There are more queries that can't match deleted docs but they
  // aren’t that common, e.g. ones using `$type` or bit-wise
  // operators.
  if (query.hasOwnProperty('$and')) {
    if (Array.isArray(query.$and)) {
      for (var i = 0; i < query.$and.length; i++) {
        if (!deletedDocCouldSatisfyQuery(query.$and[i])) {
          return false;
        }
      }
    } else {
      // Malformed? Play it safe.
      return true;
    }
  }

  for (var prop in query) {
    // Ignore fields that remain set on deleted docs
    if (
      prop === '_id' ||
      prop === '_v' ||
      prop === '_o' ||
      prop === '_m' || (
        prop[0] === '_' &&
        prop[1] === 'm' &&
        prop[2] === '.'
      )
    ) {
      continue;
    }
    // Top-level operators with special handling in this function
    if (prop === '$and' || prop === '$or') {
      continue;
    }
    // When using top-level operators that we don't understand, play
    // it safe
    if (prop[0] === '$') {
      return true;
    }
    if (!couldMatchNull(query[prop])) {
      return false;
    }
  }

  if (query.hasOwnProperty('$or')) {
    if (Array.isArray(query.$or)) {
      for (var i = 0; i < query.$or.length; i++) {
        if (deletedDocCouldSatisfyQuery(query.$or[i])) {
          return true;
        }
      }
      return false;
    } else {
      // Malformed? Play it safe.
      return true;
    }
  }

  return true;
}

function couldMatchNull(clause) {
  if (
    typeof clause === 'number' ||
    typeof clause === 'boolean' ||
    typeof clause === 'string'
  ) {
    return false;
  } else if (clause === null) {
    return true;
  } else if (isPlainObject(clause)) {
    // Mongo interprets clauses with multiple properties with an
    // implied 'and' relationship, e.g. {$gt: 3, $lt: 6}. If every
    // part of the clause could match null then the full clause could
    // match null.
    for (var prop in clause) {
      var value = clause[prop];
      if (prop === '$in' && Array.isArray(value)) {
        var partCouldMatchNull = false;
        for (var i = 0; i < value.length; i++) {
          if (value[i] === null) {
            partCouldMatchNull = true;
            break;
          }
        }
        if (!partCouldMatchNull) {
          return false;
        }
      } else if (prop === '$ne') {
        if (value === null) {
          return false;
        }
      } else if (prop === '$exists') {
        if (value) {
          return false;
        }
      } else if (prop === '$gt' || prop === '$gte' || prop === '$lt' || prop === '$lte') {
        if (value !== null) {
          return false;
        }
      } else {
        // Not sure what to do with this part of the clause; assume it
        // could match null.
      }
    }

    // All parts of the clause could match null.
    return true;
  } else {
    // Not a POJO, string, number, or boolean. Not sure what it is,
    // but play it safe.
    return true;
  }
}

function isPlainObject(value) {
  return (
    typeof value === 'object' && (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
  );
}
