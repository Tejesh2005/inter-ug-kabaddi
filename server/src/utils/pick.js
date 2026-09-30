export const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => source?.[field] !== undefined).map((field) => [field, source[field]]),
);
