// Administrative jurisdictions used by the service applicability metadata (#260).
// Levels run from the widest to the narrowest scope. A service with no `jurisdiction`
// field is "unknown": that is never the same as "national".
export const JURISDICTION_LEVELS = ['national', 'state', 'district', 'local'];

export const JURISDICTION_LEVEL_LABELS = {
  national: 'National',
  state: 'State / UT',
  district: 'District',
  local: 'Local body',
};

// The 28 states and 8 Union Territories of India.
export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
