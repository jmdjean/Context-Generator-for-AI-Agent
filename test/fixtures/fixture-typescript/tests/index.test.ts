import { add, subtract, multiply } from '../src/index';

// Basic sanity tests for arithmetic utilities
if (add(1, 2) !== 3) throw new Error('add failed');
if (subtract(5, 3) !== 2) throw new Error('subtract failed');
if (multiply(3, 4) !== 12) throw new Error('multiply failed');

console.log('All tests passed.');
