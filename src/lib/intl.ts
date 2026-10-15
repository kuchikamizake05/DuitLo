const numberFormatters = new Map<string,Intl.NumberFormat>();
const cacheLimit = 128;
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function getDateFormatter(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locales, options]);
  const cached = dateFormatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locales, options);
  if (dateFormatters.size >= cacheLimit) dateFormatters.delete(dateFormatters.keys().next().value!);
  dateFormatters.set(key, formatter);
  return formatter;
}

export function getNumberFormatter(locales?:Intl.LocalesArgument,options?:Intl.NumberFormatOptions) {
  const key=JSON.stringify([locales,options]);
  const cached=numberFormatters.get(key);
  if(cached)return cached;
  const formatter=new Intl.NumberFormat(locales,options);
  if(numberFormatters.size>=cacheLimit) numberFormatters.delete(numberFormatters.keys().next().value!);
  numberFormatters.set(key,formatter);
  return formatter;
}
