const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const convert = require('xml-js');
const protobuf = require('protobufjs');

const EmployeeList = protobuf.loadSync(path.join(__dirname, 'employee.proto')).lookupType('Employees');
const employees = {
  employee: [
    { id: 1, name: 'Ali', salary: 9000 },
    { id: 2, name: 'Kamal', salary: 22000 },
    { id: 3, name: 'Amal', salary: 23000 },
  ],
};

function validate(data) {
  if (!data || !Array.isArray(data.employee)) throw new TypeError('Une liste employee est attendue');
  const error = EmployeeList.verify(data);
  if (error) throw new TypeError(error);
  for (const employee of data.employee) {
    if (!Number.isInteger(employee.id) || employee.id < 1 || employee.id > 2147483647
        || typeof employee.name !== 'string' || !employee.name.trim()
        || !Number.isInteger(employee.salary) || employee.salary < 0 || employee.salary > 2147483647) {
      throw new TypeError('Employé invalide : id, name et salary sont obligatoires');
    }
  }
}

function encode(data) {
  validate(data);
  return {
    json: JSON.stringify(data),
    xml: '<root>\n' + convert.json2xml(data, { compact: true, ignoreComment: true, spaces: 0 }) + '\n</root>',
    proto: EmployeeList.encode(EmployeeList.create(data)).finish(),
  };
}

function decodeXml(xml) {
  const root = convert.xml2js(xml, { compact: true }).root;
  const records = root.employee ? (Array.isArray(root.employee) ? root.employee : [root.employee]) : [];
  return { employee: records.map(record => ({
    id: Number(record.id._text), name: record.name?._text || '', salary: Number(record.salary._text),
  })) };
}

// Chaque opération est mesurée séparément; les valeurs dépendent de la machine.
function measure(operation) {
  const start = performance.now();
  const value = operation();
  return { value, milliseconds: performance.now() - start };
}

function run(output = __dirname, data = employees) {
  validate(data);
  const json = measure(() => JSON.stringify(data));
  const xml = measure(() => '<root>\n' + convert.json2xml(data, { compact: true, ignoreComment: true, spaces: 0 }) + '\n</root>');
  const proto = measure(() => EmployeeList.encode(EmployeeList.create(data)).finish());
  const jsonDecoded = measure(() => JSON.parse(json.value));
  const xmlDecoded = measure(() => decodeXml(xml.value));
  const protoDecoded = measure(() => EmployeeList.toObject(EmployeeList.decode(proto.value), { defaults: true }));
  assert.deepEqual(jsonDecoded.value, data);
  assert.deepEqual(xmlDecoded.value, data);
  assert.deepEqual(protoDecoded.value, data);

  fs.mkdirSync(output, { recursive: true });
  const results = [];
  for (const [format, encoded, decoded] of [
    ['json', json, jsonDecoded], ['xml', xml, xmlDecoded], ['proto', proto, protoDecoded],
  ]) {
    const filename = path.join(output, 'data.' + format);
    fs.writeFileSync(filename, encoded.value);
    results.push({ format, bytes: fs.statSync(filename).size,
      encode_ms: Number(encoded.milliseconds.toFixed(6)), decode_ms: Number(decoded.milliseconds.toFixed(6)) });
  }
  // Relire le fichier binaire prouve aussi la symétrie après écriture sur disque.
  assert.deepEqual(EmployeeList.toObject(EmployeeList.decode(fs.readFileSync(path.join(output, 'data.proto'))), { defaults: true }), data);
  console.log('Employés :', JSON.stringify(data));
  console.table(results);
  console.log('Décodage JSON, XML et Protobuf : données identiques à la source.');
  return results;
}

if (require.main === module) run();
module.exports = { employees, EmployeeList, validate, encode, decodeXml, run };
