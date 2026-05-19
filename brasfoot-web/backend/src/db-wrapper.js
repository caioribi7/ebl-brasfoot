const { getDb, saveDatabase } = require('./database');

function prepare(sql) {
  const db = getDb();

  return {
    get(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0) return undefined;
      const columns = results[0].columns;
      const values = results[0].values;
      if (values.length === 0) return undefined;
      const row = values[0];
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    },

    all(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0) return [];
      const columns = results[0].columns;
      return results[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
    },

    run(...params) {
      db.run(sql, params);
      saveDatabase();
      return { changes: db.getRowsModified() };
    }
  };
}

function exec(sql) {
  const db = getDb();
  db.run(sql);
  saveDatabase();
}

function transaction(fn) {
  fn();
}

module.exports = { prepare, exec, transaction };
