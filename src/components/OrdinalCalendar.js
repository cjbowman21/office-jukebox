import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, RotateCcw } from 'lucide-react';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  buildMonthDays,
  formatIsoDate,
  formatLongDate,
  formatOrdinalDate,
  isLeapYear,
  isSameLocalDate,
} from '../utils/ordinalDate';

const getMonthPadding = (year, monthIndex, dayCount) => {
  const leading = new Date(year, monthIndex, 1).getDay();
  const trailing = (7 - ((leading + dayCount) % 7)) % 7;
  return { leading, trailing };
};

const OrdinalCalendar = () => {
  const [today, setToday] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextToday = new Date();
      setToday(nextToday);
      if (!hasManualSelection) {
        setSelectedDate(nextToday);
      }
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [hasManualSelection]);

  const months = useMemo(() => MONTH_NAMES.map((monthName, monthIndex) => {
    const days = buildMonthDays(selectedYear, monthIndex);
    return {
      name: monthName,
      index: monthIndex,
      days,
      padding: getMonthPadding(selectedYear, monthIndex, days.length),
    };
  }), [selectedYear]);

  const yearDayCount = isLeapYear(selectedYear) ? 366 : 365;
  const todayIsVisible = selectedYear === currentYear;
  const selectedOrdinalDate = formatOrdinalDate(selectedDate);

  const handleSelectDate = (date) => {
    setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    setHasManualSelection(true);
    setCopyStatus('');
  };

  const handleCopyOrdinalDate = async () => {
    try {
      await navigator.clipboard.writeText(selectedOrdinalDate);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <section className="calendar-view" aria-labelledby="calendar-heading">
      <div className="calendar-summary">
        <div className="calendar-summary-copy">
          <p className="eyebrow">Ordinal date reference</p>
          <h2 id="calendar-heading">Day-of-year calendar</h2>
          <dl className="date-facts" aria-label="Selected date">
            <div>
              <dt>Selected date</dt>
              <dd>{formatLongDate(selectedDate)}</dd>
            </div>
            <div className="ordinal-fact">
              <dt>Ordinal</dt>
              <dd>{selectedOrdinalDate}</dd>
              <button
                type="button"
                className="ghost-button icon-text-button copy-ordinal-button"
                onClick={handleCopyOrdinalDate}
                aria-label={`Copy ordinal date ${selectedOrdinalDate}`}
              >
                {copyStatus === 'copied'
                  ? <Check size={15} aria-hidden="true" />
                  : <Copy size={15} aria-hidden="true" />}
                {copyStatus === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </dl>
          {copyStatus === 'failed' && (
            <p className="copy-status error-text" role="status">
              Clipboard copy failed.
            </p>
          )}
        </div>

        <div className="calendar-year-controls" aria-label="Calendar year controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => setSelectedYear((year) => year - 1)}
            aria-label="Previous year"
            title="Previous year"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="year-readout" aria-live="polite">
            <CalendarDays size={18} aria-hidden="true" />
            <span>{selectedYear}</span>
            <small>{yearDayCount} days</small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setSelectedYear((year) => year + 1)}
            aria-label="Next year"
            title="Next year"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="ghost-button icon-text-button"
            onClick={() => setSelectedYear(currentYear)}
            disabled={selectedYear === currentYear}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Current year
          </button>
        </div>
      </div>

      <div className="calendar-months" aria-label={`${selectedYear} ordinal calendar`}>
        {months.map((month) => (
          <section
            className="calendar-month"
            key={month.name}
            aria-labelledby={`calendar-${selectedYear}-${month.index}`}
          >
            <h3 id={`calendar-${selectedYear}-${month.index}`}>{month.name} {selectedYear}</h3>
            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAY_NAMES.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: month.padding.leading }, (_, index) => (
                <span className="calendar-empty" key={`leading-${month.name}-${index}`} aria-hidden="true" />
              ))}
              {month.days.map((day) => {
                const isToday = todayIsVisible && isSameLocalDate(day.date, today);
                const isSelected = isSameLocalDate(day.date, selectedDate);
                const label = `${formatLongDate(day.date)}, ordinal date ${day.ordinalDate}`;

                return (
                  <button
                    type="button"
                    className={`calendar-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                    onClick={() => handleSelectDate(day.date)}
                    aria-label={label}
                    aria-pressed={isSelected}
                    key={day.ordinalDate}
                  >
                    <time dateTime={formatIsoDate(day.date)}>
                      <span className="calendar-day-number">{day.dayOfMonth}</span>
                      <span className="calendar-doy">{day.ordinalDay}</span>
                    </time>
                  </button>
                );
              })}
              {Array.from({ length: month.padding.trailing }, (_, index) => (
                <span className="calendar-empty" key={`trailing-${month.name}-${index}`} aria-hidden="true" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

export default OrdinalCalendar;
