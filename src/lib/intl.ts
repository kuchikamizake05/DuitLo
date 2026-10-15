const numberFormatters = new Map<string,Intl.NumberFormat>();
const cacheLimit = 128;

export function getNumberFormatter(locales?:Intl.LocalesArgument,options?:Intl.NumberFormatOptions) {
  const key=JSON.stringify([locales,options]);
  const cached=numberFormatters.get(key);
  if(cached)return cached;
  const formatter=new Intl.NumberFormat(locales,options);
  if(numberFormatters.size>=cacheLimit) numberFormatters.delete(numberFormatters.keys().next().value!);
  numberFormatters.set(key,formatter);
  return formatter;
}
