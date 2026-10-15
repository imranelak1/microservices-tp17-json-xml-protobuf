const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { employees, EmployeeList, encode, decodeXml, run } = require('../index');

test('les trois formats restituent les employés, y compris les accents et caractères XML', () => {
  const data = { employee: [{ id: 7, name: 'Élodie & <Ali>', salary: 12345 }] };
  const result = encode(data);
  assert.deepEqual(JSON.parse(result.json), data);
  assert.deepEqual(decodeXml(result.xml), data);
  assert.deepEqual(EmployeeList.toObject(EmployeeList.decode(result.proto)), data);
});

test('les types et les bornes int32 sont vérifiés avant encodage', () => {
  for (const record of [{ id: 0, name: 'A', salary: 1 }, { id: 1, name: '', salary: 1 },
    { id: 1, name: 'A', salary: -1 }, { id: 1, name: 'A', salary: 2147483648 },
    { id: 1, name: 'A', salary: '9000' }]) {
    assert.throws(() => encode({ employee: [record] }), TypeError);
  }
});

test('les tailles mesurées correspondent aux vrais fichiers et le binaire se relit', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tp17-'));
  try {
    const results = run(directory);
    for (const result of results) {
      assert.equal(result.bytes, fs.statSync(path.join(directory, 'data.' + result.format)).size);
      assert.ok(result.encode_ms >= 0 && result.decode_ms >= 0);
    }
    assert.deepEqual(EmployeeList.toObject(EmployeeList.decode(fs.readFileSync(path.join(directory, 'data.proto')))), employees);
    assert.ok(results[2].bytes < results[0].bytes && results[0].bytes < results[1].bytes);
  } finally {
    for (const file of ['data.json', 'data.xml', 'data.proto']) fs.rmSync(path.join(directory, file), { force: true });
    fs.rmdirSync(directory);
  }
});

test('une liste vide reste une liste vide dans les trois formats', () => {
  const data = { employee: [] };
  const result = encode(data);
  assert.deepEqual(decodeXml(result.xml), data);
  assert.deepEqual(EmployeeList.toObject(EmployeeList.decode(result.proto), { defaults: true }), data);
});
