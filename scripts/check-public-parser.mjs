import {parsePublicOdds} from './public-odds-parser.mjs';
import assert from 'node:assert/strict';
assert.deepEqual(parsePublicOdds('grana','Kigezi Homeboys\nMbarara City\n1x2\nKigezi Homeboys\n12.3\nempate\n4.1\nMbarara City\n1.25')[0].odds,[12.3,4.1,1.25]);
assert.deepEqual(parsePublicOdds('sportsbet','Kigezi Homeboyz FC\nMbarara FC\n1x2\nKigezi Homeboyz FC 2.46\nEmpate 3.00\nMbarara FC 2.64')[0].odds,[2.46,3,2.64]);
assert.equal(parsePublicOdds('sportsbet','1x2\nOutro jogo 2.40').length,0);
assert.equal(parsePublicOdds('grana','Kigezi Homeboys\nMbarara City\n1x2\nKigezi Homeboys\n0.00\nempate\n0.00\nMbarara City\n0.00').length,0);
assert.equal(parsePublicOdds('stake','Just a moment...').length,0);
console.log('Verified event identity, outcome ordering, decimal odds and unavailable markets for public collectors.');
