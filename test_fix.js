// Test the fix robustness - matching the template implementation
function testParse(jsonStr, label) {
  const months = (function() { let parsed; try { parsed = JSON.parse(jsonStr); } catch(e) { parsed = []; } return Array.isArray(parsed) ? parsed : []; })();
  try {
    console.log(label + ': length=' + months.length + ', map=' + (months.map ? 'works' : 'N/A'));
    if (months.map && months.length > 0) {
      console.log('  map month_short:', months.map(m => m.month_short));
    }
  } catch(e) {
    console.log(label + ': ERROR - ' + e.message);
  }
}

// Test case 1: Valid JSON with data
testParse('[{"month":"Jan","month_short":"Jan","applications":5,"shortlisted":2,"accepted":1}]', 'Test 1: With data');

// Test case 2: Valid JSON empty array
testParse('[]', 'Test 2: Empty array');

// Test case 3: JSON.parse('null') returns null (doesnt throw)
testParse('null', 'Test 3: null (JSON.parse returns null)');

// Test case 4: Invalid JSON (empty string)
testParse('', 'Test 4: empty string');

// Test case 5: Invalid JSON (malformed)
testParse('not json at all', 'Test 5: malformed');

// Test case 6: Valid data with all fields
testParse('[{"month":"Feb","month_short":"Feb","applications":10,"shortlisted":4,"accepted":3}]', 'Test 6: Full data');

console.log('\nAll edge case tests completed!');