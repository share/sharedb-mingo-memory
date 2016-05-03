# ShareDBMingo

  [![NPM Version](https://img.shields.io/npm/v/sharedb-mingo-memory.svg)](https://npmjs.org/package/sharedb-mingo-mongo)
  [![Build Status](https://travis-ci.org/avital/sharedb-mingo-memory.svg?branch=master)](https://travis-ci.org/avital/sharedb-mingo-memory)
  [![Coverage Status](https://coveralls.io/repos/github/avital/sharedb-mingo-memory/badge.svg?branch=master)](https://coveralls.io/github/avital/sharedb-mingo-memory?branch=master)

A database adapter for [sharedb](https://github.com/share/sharedb)
that implements a subset of Mongo operations using an in-memory
database. Used by sharedb tests. Might be useful for running some
application tests faster by not requiring a full database.

## Usage

```js
var MemoryDB = require('sharedb').MemoryDB;
var ShareDBMingo = require('sharedb-mingo-memory').extendMemoryDB(MemoryDB);
var db = new ShareDBMingo();
```

This module intentionally does not depend on sharedb directly, so that
it can be used by sharedb tests without having two copies of the
sharedb module.

## Queries

sharedb-mingo-memory uses [mingo](https://github.com/kofrasa/mingo)
and supports the same queries mingo supports. In addition, some special
top-level fields are supported, and map to Mongo cursor methods:
* `$orderby` (TODO: rename to `$sort`)
* `$skip`
* `$limit`
* `$count`

Other special operators that are supported in sharedb-mongo such as
`$mapReduce` and `$aggregate` aren't supported and will throw an error
if used.
