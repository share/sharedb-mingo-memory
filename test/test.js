var expect = require('expect.js');
var ShareDBMingo = require('../index');

function create(callback) {
  var db = ShareDBMingo();
  callback(null, db);
}

require('sharedb/test/db')(create);

