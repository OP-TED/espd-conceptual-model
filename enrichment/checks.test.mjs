// Tests for the checks in checks.mjs. Run with: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateKeys, schemaHasPath } from './checks.mjs';

test('a repeated key in the same object is reported with the path of that object', () => {
  const text = '{ "components": { "a": { "id": "x", "id": "y" }, "b": { "id": "z" } }, "list": [ { "k": 1, "k": 2 } ] }';
  assert.deepEqual(findDuplicateKeys(text), [
    'duplicate key "id" in /components/a',
    'duplicate key "k" in /list/0',
  ]);
});

test('the same key in different objects, strings that look like keys and empty containers are fine', () => {
  const text = '{ "a": { "id": 1 }, "b": { "id": 2 }, "s": "{\\"id\\": 1, \\"id\\": 2}", "e": {}, "l": [], "n": [1, 2.5e3, true, null, "x"] }';
  assert.deepEqual(findDuplicateKeys(text), []);
});

test('text that is not valid JSON is an error, not a silent pass', () => {
  assert.throws(() => findDuplicateKeys('{ "a": 1,, }'), SyntaxError);
  assert.throws(() => findDuplicateKeys('{ "a": 1 } trailing'), SyntaxError);
  assert.throws(() => findDuplicateKeys('{ "a": "unterminated }'), SyntaxError);
});

const schema = {
  type: 'object',
  properties: {
    partI: {
      type: 'object',
      properties: {
        buyer: { $ref: '#/$defs/buyer' },
        lots: { type: 'array', items: { $ref: '#/$defs/lot' } },
        choice: {
          oneOf: [
            { properties: { viaOneOf: { type: 'string' } } },
            { properties: { other: { type: 'string' } } },
          ],
        },
        guarded: {
          type: 'object',
          allOf: [{ if: { properties: { kind: { const: 'a' } } }, then: { properties: { extra: { type: 'string' } } }, else: { properties: { fallback: { type: 'string' } } } }],
        },
      },
    },
  },
  $defs: {
    buyer: { type: 'object', properties: { name: { type: 'string' }, address: { allOf: [{ $ref: '#/$defs/address' }] } } },
    address: { type: 'object', properties: { city: { type: 'string' } } },
    lot: { type: 'object', properties: { id: { type: 'string' } } },
  },
};

test('a path through objects, $ref and array items is found, with or without []', () => {
  assert.ok(schemaHasPath(schema, 'partI.buyer.name'));
  assert.ok(schemaHasPath(schema, 'partI.lots'));
  assert.ok(schemaHasPath(schema, 'partI.lots.id'));
  assert.ok(schemaHasPath(schema, 'partI.lots[].id'));
});

test('a property declared only inside allOf, oneOf, if, then or else is found', () => {
  assert.ok(schemaHasPath(schema, 'partI.buyer.address.city'), 'allOf with $ref');
  assert.ok(schemaHasPath(schema, 'partI.choice.viaOneOf'), 'oneOf branch');
  assert.ok(schemaHasPath(schema, 'partI.choice.other'), 'another oneOf branch');
  assert.ok(schemaHasPath(schema, 'partI.guarded.kind'), 'if');
  assert.ok(schemaHasPath(schema, 'partI.guarded.extra'), 'then');
  assert.ok(schemaHasPath(schema, 'partI.guarded.fallback'), 'else');
});

test('a path that does not exist is rejected, also below a composition', () => {
  assert.equal(schemaHasPath(schema, 'partI.buyer.nope'), false);
  assert.equal(schemaHasPath(schema, 'partI.buyer.address.zip'), false);
  assert.equal(schemaHasPath(schema, 'partII.buyer'), false);
  assert.equal(schemaHasPath(schema, 'partI.name.deeper'), false);
});

test('a $ref cycle does not loop forever', () => {
  const cyclic = { properties: { a: { $ref: '#/$defs/n' } }, $defs: { n: { properties: { next: { $ref: '#/$defs/n' } } } } };
  assert.ok(schemaHasPath(cyclic, 'a.next.next.next'));
  assert.equal(schemaHasPath(cyclic, 'a.next.missing'), false);
});
