export const makeDottedIReadable = (value: any) => {
  return String(value ?? '')
    .replace(/i\u0307/g, 'i')
    .replace(/I\u0307/g, 'İ');
};

export const normalizeDottedIForCompare = (value: any) => {
  return makeDottedIReadable(value)
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};
