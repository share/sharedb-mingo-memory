// Given a key/value comparison query, return a query object with that
// filter and a specified sort order. The 'order' argument looks like
// [['foo', 1], ['bar', -1]] for sort by foo asending, then bar
// descending. This function is passed into
function makeSortedQuery(inputQuery, order) {
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

module.exports = makeSortedQuery;
