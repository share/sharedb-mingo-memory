// Given a key/value comparison query, return a query object with that
// filter and a specified sort order. The 'order' argument looks like
// [['foo', 1], ['bar', -1]] for sort by foo asending, then bar
// descending. This function is passed into the sharedb test suite.
function makeQuery(options) {
  var inputQuery = options.query;
  var sort = options.sort;

  if (sort) {
    // Convert sort order to Mongo's expected structure
    if (!Array.isArray(sort)) throw new Error("invalid sort order");
    if (sort.length > 0) {
      var mongoSort = {};
      for (var i = 0; i < sort.length; i++) {
        if (!Array.isArray(sort[i]) || sort[i].length !== 2) {
          throw new Error("invalid sort order");
        }
        mongoSort[sort[i][0]] = sort[i][1];
      }
      var query = JSON.parse(JSON.stringify(inputQuery));
      query.$sort = mongoSort;
      return query;
    }
  }

  return inputQuery;
};

module.exports = makeQuery;
