export const hasUniqueObjectIds = (values = []) => {
  const normalized = values.map((value) => value?.toString());
  return normalized.length === new Set(normalized).size;
};

export const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const nonNegativeInteger = {
  type: Number,
  min: 0,
  default: 0,
  validate: {
    validator: Number.isInteger,
    message: '{PATH} must be an integer',
  },
};

export const requiredNonNegativeInteger = {
  ...nonNegativeInteger,
  required: true,
};

export const requiredPositiveInteger = {
  type: Number,
  min: 1,
  required: true,
  validate: {
    validator: Number.isInteger,
    message: '{PATH} must be a positive integer',
  },
};
