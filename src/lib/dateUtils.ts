import { format } from 'date-fns';
import { pt, es, enUS } from 'date-fns/locale';

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY';

export const getDateLocale = (language: string) => {
  switch (language) {
    case 'pt':
      return pt;
    case 'es':
      return es;
    default:
      return enUS;
  }
};

export const formatDate = (
  date: Date | string,
  userFormat: DateFormat = 'DD/MM/YYYY',
  language: string = 'en'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (userFormat === 'MM/DD/YYYY') {
    return format(dateObj, 'MM/dd/yyyy', { locale: getDateLocale(language) });
  } else {
    return format(dateObj, 'dd/MM/yyyy', { locale: getDateLocale(language) });
  }
};

export const formatDateTime = (
  date: Date | string,
  userFormat: DateFormat = 'DD/MM/YYYY',
  language: string = 'en'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (userFormat === 'MM/DD/YYYY') {
    return format(dateObj, 'MM/dd/yyyy HH:mm', { locale: getDateLocale(language) });
  } else {
    return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: getDateLocale(language) });
  }
};