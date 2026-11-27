/** Service Appointment Availability Heatmap
 * Renders a monthly heatmap calendar showing slot availability across dates.
 * Colour-independent text legend ensures accessibility for color-blind users.
 * Provides an accessible list alternative for every visual element.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  SLOT_STATUS,
  getSortedSlotDates,
  hasAvailableSlots,
  hasLimitedSlots,
  allDatesFull,
  createSlotFeed,
  updateSlotDate,
  removeSlotDate,
  validateSlotFeedPayload,
} from '../data/slotFeeds';
import { CIVIC_OFFICES } from '../data/locationOffices';
import { MOCK_SERVICES } from '../data/services';
import { BookOpen, ChevronLeft, ChevronRight, Info, AlertCircle } from 'lucide-react';

const STATUS_CLASSES = {
  AVAILABLE: 'slot-available',
  LIMITED: 'slot-limited',
  FULL: 'slot-full',
  UNAVAILABLE: 'slot-unavailable',
};

export default function SlotAvailabilityHeatmap({
  officeId,
  serviceId,
  initialDate,
  onDateSelect,
  onRefresh,
  label: labelProp,
}) {
  const [slotFeed, setSlotFeed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showListView, setShowListView] = useState(false);
  const [focusedDate, setFocusedDate] = useState(null);

  const office = CIVIC_OFFICES.find((o) => o.id === officeId);
  const service = MOCK_SERVICES.find((s) => s.id === serviceId);
  const displayLabel =
    labelProp || (office && service ? office.name + ' - ' + service.name : 'Office & Service');

  useEffect(() => {
    let mounted = true;

    async function loadFeed() {
      setIsLoading(true);
      setError(null);

      try {
        const feed = await fetchSlotFeed(officeId, serviceId);
        if (mounted) {
          setSlotFeed(feed);
        }
      } catch (err) {
        if (mounted) {
          if (
            err.message &&
            (err.message.includes('not authorized') || err.message.includes('not found'))
          ) {
            setSlotFeed(createNoFeedSlotFeed(office, service));
            setError(
              'No live slot feed available. Showing office-published appointment instructions.'
            );
          } else {
            setError(err.message || 'Failed to load slot feed');
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadFeed();

    return () => {
      mounted = false;
    };
  }, [officeId, serviceId]);

  const sortedDates = slotFeed ? getSortedSlotDates(slotFeed) : [];
  const hasLiveData =
    slotFeed && slotFeed.feedFreshness !== 'offline';
  const feedFreshnessLabel = getFeedFreshnessLabel(slotFeed);
  const lastCheckedLabel = getLastCheckedLabel(slotFeed);

  const handleDateSelect = useCallback(
    function (date, detail) {
      setFocusedDate(date);
      if (onDateSelect) {
        onDateSelect(date, detail);
      }
    },
    [onDateSelect]
  );

  const refreshFeed = useCallback(
    function () {
      setIsLoading(true);
      setError(null);
      fetchSlotFeed(officeId, serviceId, true).then(function (feed) {
        if (slotFeed) {
          setSlotFeed(feed);
        }
      });
      if (onRefresh) {
        onRefresh();
      }
    },
    [officeId, serviceId, onRefresh, slotFeed]
  );

  if (isLoading) {
    return renderLoadingState(office, service);
  }

  if (error) {
    return renderErrorState(error, office, service, refreshFeed);
  }

  if (!slotFeed && !isLoading) {
    return renderNoFeedState(office, service, refreshFeed);
  }

  return renderHeatmap(
    slotFeed,
    displayLabel,
    office,
    service,
    sortedDates,
    focusedDate,
    handleDateSelect,
    feedFreshnessLabel,
    lastCheckedLabel,
    onRefresh,
    showListView,
    setShowListView,
    navigateMonth
  );
}

function renderLoadingState(office, service) {
  return (
    <div
      className="slot-availability-loading"
      aria-live="polite"
      aria-busy="true"
      style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}
    >
      <span className="lucide-loading" aria-hidden="true" /> <span>Loading appointment slot availability...</span>
    </div>
  );
}

function renderErrorState(error, office, service, refreshFeed) {
  return (
    <div
      className="slot-availability-error"
      aria-live="polite"
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-error, #dc2626)',
        background: 'rgba(220, 38, 38, 0.05)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <AlertCircle size={24} aria-hidden="true" /> <span>{error}</span> <br />
      <button
        onClick={refreshFeed}
        style={{
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
          background: 'none',
          border: '1px var(--border-light)',
          color: 'var(--text-primary)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          font: 'inherit',
        }}
        aria-label="Refresh slot feed"
      >
        Retry
      </button>
      <div
        style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
      >
        <strong>Office guidance:</strong> {getFallbackGuidance(office, service)}
      </div>
    </div>
  );
}

function renderNoFeedState(office, service, refreshFeed) {
  return (
    <div
      className="slot-availability-no-feed"
      aria-live="polite"
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <InfoCircle size={24} aria-hidden="true" /> <span>
        No live slot feed available for {service.name} at {office.name}.
      </span> <br />
      <span
        style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}
      >
        Showing office-published appointment instructions.
      </span> <br />
      <button
        onClick={refreshFeed}
        style={{
          marginTop: '0.5rem',
          background: 'none',
          border: '1px var(--border-light)',
          color: 'var(--text-primary)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          font: 'inherit',
        }}
        aria-label="Refresh slot feed"
      >
        Retry
      </button>
      <div
        style={{ marginTop: '1rem', fontSize: '0.875rem' }}
      >
        <details>
          <summary>Office appointment instructions</summary>
          <p
            style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-primary)' }}
          >
            Please contact {office.name} directly{' '}
            <a
              href={service.officialSources?.[0]?.url || office.contact?.portalUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {service.officialSources?.[0]?.url || office.contact?.portalUrl || 'official portal'}
            </a>
          </p>
          <p
            style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
          >
            <strong>Instructions:</strong> {getFallbackGuidance(office, service)}
          </p>
        </details>
      </div>
    </div>
  );
}

function renderHeatmap(
  slotFeed,
  displayLabel,
  office,
  service,
  sortedDates,
  focusedDate,
  handleDateSelect,
  feedFreshnessLabel,
  lastCheckedLabel,
  onRefresh,
  showListView,
  setShowListView,
  navigateMonth
) {
  var totalDates = sortedDates.length;
  var hasData = totalDates > 0;
  var hasAnyAvailable = hasAvailableSlots(slotFeed);
  var hasAnyLimited = hasLimitedSlots(slotFeed);
  var allFull = allDatesFull(slotFeed);

  var firstDate = sortedDates[0]?.date;
  var monthYear = firstDate
    ? new Date(firstDate).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      });

  var prevMonthBtn = (
    <button
      type="button"
      onClick={() => navigateMonth('previous')}
      style={{
        width: '40px',
        height: '40px',
        flexShrink: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '1.5rem',
        cursor: 'pointer',
      }}
      aria-label="Previous month"
    >
      <ChevronLeft size={20} aria-hidden="true" />
    </button>
  );

  var nextMonthBtn = (
    <button
      type="button"
      onClick={() => navigateMonth('next')}
      style={{
        width: '40px',
        height: '40px',
        flexShrink: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '1.5rem',
        cursor: 'pointer',
      }}
      aria-label="Next month"
    >
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );

  var monthTitle = (
    <h3
      style={{
        margin: '0',
        padding: '0.5rem 1rem',
        textAlign: 'center',
        color: 'var(--text-primary)',
        fontSize: '1.25rem',
        fontWeight: '600',
      }}
    >
      {monthYear}
    </h3>
  );

  var dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  var generateCalendarGrid = function () {
    if (!hasData) {
      return <p>No date data available</p>;
    }

    var firstDayOfMonth = new Date(firstDate).getDay();

    var cells = [];

    for (var i = 0; i < firstDayOfMonth; i++) {
      cells.push(
        <div
          key={ 'empty-' + i }
          className="calendar-cell calendar-cell-empty"
          aria-hidden="true"
          style={{ width: 'calc(100% / 7)', height: 'calc(100% / 7)', background: 'transparent' }}
        ></div>
      );
    }

    sortedDates.forEach(function (dateDetail, idx) {
      var isToday =
        dateDetail.date === new Date().toISOString().split('T')[0];

      var statusClass = STATUS_CLASSES[dateDetail.status];

      var cellClassMap = {
        [statusClass]: true,
        'calendar-cell': true,
        'calendar-cell-focused': focusedDate && focusedDate === dateDetail.date,
        'calendar-cell-today': isToday,
      };

      var hasDetails =
        dateDetail.slotCount !== null || dateDetail.fromLiveFeed;

      cells.push(
        <div
          key={ dateDetail.date }
          className="calendar-cell"
          style={{
            width: 'calc(100% / 7)',
            height: 'calc(100% / 7)',
            background:
              cellClassMap[statusClass]
                ? 'var(--slot-' + statusClass + '-bg)'
                : 'transparent',
            color:
              cellClassMap[statusClass]
                ? 'var(--slot-' + statusClass + '-fg)'
                : 'var(--text-primary)',
            cursor: 'pointer',
          }}
          role="gridcell"
          tabIndex="0"
          aria-label={ dateDetail.date + ' ' + (dateDetail.slotDescription || '') + ' ' + (dateDetail.fromLiveFeed ? 'Live' : 'No feed') + ' ' + (dateDetail.isFresh ? 'Fresh' : 'Stale') + ' ' + (focusedDate && focusedDate === dateDetail.date ? 'Selected' : '') }
          onClick={() => handleDateSelect(dateDetail.date, dateDetail)}
        >
          <span
            style={{
              display: 'block',
              padding: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: isToday ? '600' : '500',
            }}
          >
            {formatDateShort(dateDetail.date)}
          </span>
          {dateDetail.slotCount !== null && (
            <span
              style={{
                display: 'block',
                padding: '0.1rem 0.25rem',
                fontSize: '0.65rem',
                marginTop: '0.1rem',
                borderRadius: '99px',
                background:
                  dateDetail.status === SlotStatusExports.AVAILABLE
                    ? 'rgba(34, 197, 94, 0.15)'
                    : dateDetail.status === SlotStatusExports.LIMITED
                    ? 'rgba(245, 158, 11, 0.15)'
                    : dateDetail.status === SlotStatusExports.FULL
                    ? 'rgba(220, 38, 38, 0.15)'
                    : 'transparent',
                color:
                  dateDetail.status === SlotStatusExports.AVAILABLE
                    ? 'var(--accent-main)'
                    : dateDetail.status === SlotStatusExports.LIMITED
                    ? 'var(--accent-warning)'
                    : dateDetail.status === SlotStatusExports.FULL
                    ? 'var(--accent-error)'
                    : 'var(--text-tertiary)',
              }}
            >
              {dateDetail.slotCount}
            </span>
          )}
          {hasDetails && !isToday && (
            <small
              style={{
                display: 'block',
                padding: '0.1rem 0.25rem',
                fontSize: '0.65rem',
                marginTop: '0.1rem',
                color: 'var(--text-secondary)',
              }}
            >
              {dateDetail.slotDescription}
            </small>
          )}
          {isToday && dateDetail.slotDescription && (
            <span
              style={{
                display: 'block',
                padding: '0.1rem 0.25rem',
                fontSize: '0.65rem',
                marginTop: '0.1rem',
                borderRadius: '99px',
              }}
            >
              {dateDetail.slotDescription}
            </span>
          )}
        </div>
      );
    });

    var totalCells = firstDayOfMonth + totalDates;
    var remaining = 42 - totalCells;
    for (var i = 0; i < remaining; i++) {
      cells.push(
        <div
          key={ 'trailing-' + i }
          className="calendar-cell calendar-cell-empty"
          aria-hidden="true"
          style={{ width: 'calc(100% / 7)', height: 'calc(100% / 7)', background: 'transparent' }}
        ></div>
      );
    }

    var rows = [];
    for (var r = 0; r < 6; r++) {
      var rowStart = r * 7;
      var rowCells = cells.slice(rowStart, rowStart + 7);
      if (rowCells.length < 7) {
        var padded = [].concat(rowCells, new Array(7 - rowCells.length));
        rows.push(
          <div
            key={ 'row-' + r }
            className="calendar-row"
            style={{ display: 'flex', width: '100%' }}
          >
            {padded.map(function (cell, i) {
              if (cell === null) {
                return (
                  <div
                    key={ 'empty-' + r + '-' + (r * 7 + i) }
                    className="calendar-cell calendar-cell-empty"
                    aria-hidden="true"
                    style={{ width: 'calc(100% / 7)', height: 'calc(100% / 7)', background: 'transparent' }}
                  ></div>
                );
              }
              return cell;
            })}
          </div>
        );
      } else {
        rows.push(
          <div
            key={ 'row-' + r }
            className="calendar-row"
            style={{ display: 'flex', width: '100%' }}
          >
            {rowCells}
          </div>
        );
      }
    }

    return <div className="calendar-grid">{rows}</div>;
  };

  var renderLegend = function () {
    var statusLabels = {
      AVAILABLE: {
        label: 'Available',
        bg: 'var(--slot-available-bg, rgba(34, 197, 94, 0.15))',
        fg: 'var(--slot-available-fg, rgba(34, 197, 94, 0.8))',
        count:
          hasAnyAvailable
            ? 'some dates have availability'
            : 'no dates currently available',
      },
      LIMITED: {
        label: 'Limited',
        bg: 'var(--slot-limited-bg, rgba(245, 158, 11, 0.15))',
        fg: 'var(--slot-limited-fg, rgba(245, 158, 11, 0.8))',
        count:
          hasAnyLimited
            ? 'some dates have limited slots'
            : 'no dates currently limited',
      },
      FULL: {
        label: 'Full',
        bg: 'var(--slot-full-bg, rgba(220, 38, 38, 0.15))',
        fg: 'var(--slot-full-fg, rgba(220, 38, 38, 0.8))',
        count: allFull ? 'all dates are full' : 'some dates have available slots',
      },
      UNAVAILABLE: {
        label: 'Unavailable',
        bg: 'var(--slot-unavailable-bg, rgba(100, 116, 139, 0.15))',
        fg: 'var(--slot-unavailable-fg, rgba(100, 116, 139, 0.8))',
        count: 'no feed data for these dates',
      },
    };

    return (
      <div
        className="slot-availability-legend"
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'var(--glass-bg-subtle)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
        }}
      >
        <p
          style={{
            margin: '0 0 0.5rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}
        >
          Legend for {displayLabel}
        </p>
        <dl style={{ margin: 0, display: 'grid', gap: '0.5rem' }}>
          {Object.entries(statusLabels).map(function (statusInfo) {
            var status = statusInfo[0];
            var info = statusInfo[1];
            return (
              <div
                key={ status }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0',
                  borderRadius: 'var(--radius-sm)',
                  background: info.bg,
                  color: info.fg,
                }}
              >
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    flexShrink: '0',
                    borderRadius: '99px',
                    background:
                      status === SlotStatusExports.AVAILABLE
                        ? 'rgba(34, 197, 94, 0.3)'
                        : status === SlotStatusExports.LIMITED
                        ? 'rgba(245, 158, 11, 0.3)'
                        : status === SlotStatusExports.FULL
                        ? 'rgba(220, 38, 38, 0.3)'
                        : 'rgba(100, 116, 139, 0.3)',
                  }}
                  aria-hidden="true"
                />
                <span
                  style={{                  
                    display: "block",
                    padding: "0.25rem",
                    fontSize: "0.875rem",
                    fontWeight: isToday ? "600" : "500",
                  }}
                >
                  {formatDateShort(dateDetail.date)}
                </span>
                <dt
                  style={{
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    color: info.fg,
                  }}
                >
                  {info.label}
                </dt>
                <dd
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {info.count}
                </dd>
              </div>
            );
          })}
        </dl>
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
          }}
        >
          Colours are for visual guidance only. Text labels convey the actual slot status.
          {feedFreshnessLabel} {lastCheckedLabel}
        </p>
      </div>
    );
  };

  var renderListAlternative = function () {
    if (!sortedDates || sortedDates.length === 0) {
      return <p>No slot data available for this month.</p>;
    }

    return (
      <section
        className="slot-availability-list"
        style={{
          marginTop: '1rem',
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--glass-bg-subtle)',
        }}
      >
        <h4
          style={{
            margin: '0.5rem 1rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}
        >
          {showListView ? 'List view' : 'Slot availability list'} {displayLabel}
        </h4>

        <button
          type="button"
          onClick={() => setShowListView(false)}
          style={{
            float: 'right',
            fontSize: '0.75rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          &uarr; Switch to heatmap
        </button>

        <dl style={{ margin: '0 1rem 1rem' }}>
          {sortedDates.map(function (dateDetail) {
            var isToday =
              dateDetail.date === new Date().toISOString().split('T')[0];
            var statusClass = STATUS_CLASSES[dateDetail.status];

            return (
              <div
                key={ dateDetail.date }
                style={{
                  margin: '0.5rem 0',
                  padding: '0.5rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--glass-bg-subtle)',
                  transition:
                    'reduced-motion' === 'reduce' ? 'none' : 'background-color 0.2s ease',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      flexShrink: '0',
                      borderRadius: '99px',
                      background:
                        dateDetail.status === SlotStatusExports.AVAILABLE
                          ? 'rgba(34, 197, 94, 0.3)'
                          : dateDetail.status === SlotStatusExports.LIMITED
                          ? 'rgba(245, 158, 11, 0.3)'
                          : dateDetail.status === SlotStatusExports.FULL
                          ? 'rgba(220, 38, 38, 0.3)'
                          : 'rgba(100, 116, 139, 0.3)',
                  }}
                  aria-hidden="true"
                />
                <span
                  style={{                  
                    display: "block",
                    padding: "0.25rem",
                    fontSize: "0.875rem",
                    fontWeight: isToday ? "600" : "500",
                  }}
                >
                  {formatDateShort(dateDetail.date)}
                </span>
                  <div>
                    <dt
                      style={{
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatDateLong(dateDetail.date)} {isToday && '← today'}
                    </dt>
                    <dd
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {dateDetail.slotDescription}
                    </dd>
                  </div>
                </div>

                {dateDetail.slotCount !== null && (
                  <div
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: getStatusColor(dateDetail.status),
                    }}
                  >
                    Slots: {dateDetail.slotCount}{' '}
                    {dateDetail.status === SlotStatusExports.AVAILABLE && (
                      <span style={{ color: 'var(--accent-main)' }}>available</span>
                    )}
                    {dateDetail.status === SlotStatusExports.LIMITED && (
                      <span style={{ color: 'var(--accent-warning)' }}>limited</span>
                    )}
                    {dateDetail.status === SlotStatusExports.FULL && (
                      <span style={{ color: 'var(--accent-error)' }}>full</span>
                    )}
                  </div>
                )}

                <details>
                  <summary>View details</summary>
                  <p>
                    <strong>Date:</strong> {formatDateLong(dateDetail.date)}{
                      isToday && '(today)'
                    }
                  </p>
                  <p>
                    <strong>Status:</strong> {dateDetail.status}
                  </p>
                  <p>
                    <strong>Source:</strong> {dateDetail.fromLiveFeed
                      ? 'Live slot feed'
                      : 'Office instructions'}
                  </p>
                  {dateDetail.fromLiveFeed && dateDetail.isFresh && (
                    <p>
                      <strong>Freshness:</strong> Data checked {lastCheckedLabel}
                    </p>
                  )}
                  {!dateDetail.fromLiveFeed && (
                    <p>
                      <strong>Note:</strong> No live slot feed available. This shows office-published appointment guidance only.
                    </p>
                  )}
                </details>
              </div>
            );
          })}
        </dl>
      </section>
    );
  };

  return (
    <div
      className="slot-availability-heatmap"
      style={{ width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <h2
          style={{
            margin: '0',
            fontSize: '1.5rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}
        >
          {displayLabel}
        </h2>
        {showListView ? null : (
          <button
            type="button"
            onClick={() => setShowListView(true)}
            style={{
              marginLeft: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            &darr; Switch to list
          </button>
        )}
        {isLoading || error || (slotFeed && slotFeed.feedFreshness === 'offline')
          ? null
          : (
            <button
              type="button"
              onClick={refreshFeed}
              style={{
                marginLeft: '0.5rem',
                background: 'transparent',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              &rarr;
            </button>
          )
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        {prevMonthBtn}
        {monthTitle}
        {nextMonthBtn}
      </nav>

      <div
        style={{
          display: 'grid',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {generateCalendarGrid()}
      </div>

      {renderLegend()}

      {renderListAlternative()}

      <footer
        style={{
          marginTop: '1rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}
      >
        <p>
          Feed freshness: {feedFreshnessLabel} | Last checked: {lastCheckedLabel}
        </p>
        <p>{'Click or press Enter on any date to inspect the official booking destination.'}</p>
        <p>{'Booking always opens the official government portal.'}</p>
        <p>{'Tip: Use left/right arrow keys to navigate between dates, up/down to move between weeks.'}</p>
      </footer>
    </div>
  );
}

function formatDateShort(dateStr) {
  var date = new Date(dateStr);
  return (
    String(date.getMonth() + 1).padStart(2, '0') +
    '/' +
    String(date.getDate()).padStart(2, '0')
  );
}

function formatDateLong(dateStr) {
  var date = new Date(dateStr);
  return (
    date.toLocaleString('en-US', { month: 'long' }) +
    ' ' +
    date.getDate() +
    ', ' +
    date.getFullYear()
  );
}

function getFeedFreshnessLabel(feed) {
  if (!feed) return 'checking feed...';
  var diffMinutes = (new Date().getTime() - new Date(feed.sourceTimestamp).getTime()) / 60000;
  if (diffMinutes <= 30) {
    return 'Fresh (checked within ' + Math.round(diffMinutes) + ' min)';
  }
  return 'Stale (checked ' + Math.round(diffMinutes) + ' min ago)';
}

function getLastCheckedLabel(feed) {
  if (!feed) return '';
  return (
    'Last checked ' +
    new Date(feed.lastChecked).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

function getFallbackGuidance(office, service) {
  var instructions = service.steps ? service.steps[0].description : '';
  return instructions || 'Please contact the office directly for appointment information.';
}

function getStatusColor(status) {
  if (status === SlotStatusExports.AVAILABLE) {
    return 'var(--accent-main)';
  }
  if (status === SlotStatusExports.LIMITED) {
    return 'var(--accent-warning)';
  }
  if (status === SlotStatusExports.FULL) {
    return 'var(--accent-error)';
  }
  return 'var(--text-tertiary)';
}
