import json

# Test empty array case (like when no data)
empty = json.loads('[]')
print('Empty array:', empty, 'length:', len(empty))

# Test with data
with_data = json.loads('[{"month": "Jan", "month_short": "Jan", "applications": 5, "shortlisted": 2, "accepted": 1}]')
print('With data:', with_data, 'length:', len(with_data))
print('map applications:', [m['applications'] for m in with_data])
print('map month_short:', [m['month_short'] for m in with_data])