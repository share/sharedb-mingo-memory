# ShareDBMingo

  [![NPM Version](https://img.shields.io/npm/v/sharedb-mingo-memory.svg)](https://npmjs.org/package/sharedb-mingo-mongo)
  [![Build Status](https://travis-ci.org/avital/sharedb-mingo-memory.svg?branch=master)](https://travis-ci.org/avital/sharedb-mingo-memory)
  [![Coverage Status](https://coveralls.io/repos/github/avital/sharedb-mingo-memory/badge.svg?branch=master)](https://coveralls.io/github/avital/sharedb-mingo-memory?branch=master)

A database adapter for [sharedb](https://github.com/share/sharedb)
that implements a subset of Mongo operations using an in-memory
database. This adapter can be useful for running application tests
faster by not requiring a full database. It is also used by tests for
sharedb itself.

## Usage

```js
var ShareDBMingo = require('sharedb-mingo-memory');
var db = new ShareDBMingo();
```

Another form is useful at times:
`ShareDBMingo.extendMemoryDB(MemoryDB)`.  This creates a new
ShareDBMingo class that extends from a particular MemoryDB class, in
case there are more than one available. This is particularly important
to ensure sharedb tests aren't testing the version of sharedb being
used by sharedb-mingo-memory.

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
