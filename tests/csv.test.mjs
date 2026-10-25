import assert from 'node:assert/strict';
import { parseCsv, toCsv, detectDelimiter } from '../src/lib/csv.js';

// koma, kutip, baris baru di dalam kutip, CRLF, BOM
let r = parseCsv('\uFEFFa,b,c\r\n1,"x,y","line1\nline2"\r\n"q""t",2,3\r\n');
assert.deepEqual(r, [['a', 'b', 'c'], ['1', 'x,y', 'line1\nline2'], ['q"t', '2', '3']]);

// titik koma (Excel Indonesia)
assert.equal(detectDelimiter('Nama;Email;Nilai\nA;a@x.id;80,5'), ';');
r = parseCsv('Nama;Email;Nilai\nA;a@x.id;80,5');
assert.deepEqual(r[1], ['A', 'a@x.id', '80,5']);

// baris kosong dibuang, baris terakhir tanpa newline tetap terbaca
assert.deepEqual(parseCsv('a,b\n\n1,2'), [['a', 'b'], ['1', '2']]);

// tulis lalu baca lagi
const back = parseCsv(toCsv([['n', 'v'], ['a,b', 'he said "hi"'], ['x', '']]));
assert.deepEqual(back, [['n', 'v'], ['a,b', 'he said "hi"'], ['x', '']]);

console.log('csv.test OK');
