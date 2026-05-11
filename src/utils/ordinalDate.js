export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const getDayOfYear = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const yearStart = Date.UTC(year, 0, 1);
  const currentDay = Date.UTC(year, month, day);

  return Math.floor((currentDay - yearStart) / 86400000) + 1;
};

export const formatDayOfYear = (dayOfYear) => dayOfYear.toString().padStart(3, '0');

export const formatOrdinalDate = (date) => {
  const year = date.getFullYear();
  return `${year}${formatDayOfYear(getDayOfYear(date))}`;
};

export const formatIsoDate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatLongDate = (date) => new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(date);

export const isSameLocalDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
);

export const buildMonthDays = (year, monthIndex) => {
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    const dayOfYear = getDayOfYear(date);

    return {
      date,
      dayOfMonth: index + 1,
      dayOfYear,
      ordinalDay: formatDayOfYear(dayOfYear),
      ordinalDate: formatOrdinalDate(date),
    };
  });
};
