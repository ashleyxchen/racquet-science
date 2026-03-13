/**
 * TimeRangeSelector - Preset buttons + custom date picker for analytics
 */

import { useState } from 'react';
import { DateRangePreset, CustomDateRange } from '../../types/analytics';

interface TimeRangeSelectorProps {
  selectedPreset: DateRangePreset;
  customRange: CustomDateRange | null;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: CustomDateRange) => void;
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
];

export function TimeRangeSelector({
  selectedPreset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: TimeRangeSelectorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    customRange?.startDate.toISOString().split('T')[0] || ''
  );
  const [endDate, setEndDate] = useState<string>(
    customRange?.endDate.toISOString().split('T')[0] || ''
  );

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
      onPresetChange(preset);
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      const range: CustomDateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
      onCustomRangeChange(range);
      onPresetChange('custom');
      setShowDatePicker(false);
    }
  };

  const formatDateRange = () => {
    if (selectedPreset === 'custom' && customRange) {
      const start = customRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = customRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }
    return null;
  };

  return (
    <div className="time-range-selector">
      <div className="preset-buttons">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            className={`preset-button ${selectedPreset === preset.value ? 'active' : ''}`}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          className={`preset-button ${selectedPreset === 'custom' ? 'active' : ''}`}
          onClick={() => handlePresetClick('custom')}
        >
          {formatDateRange() || 'Custom'}
        </button>
      </div>

      {showDatePicker && (
        <div className="custom-date-picker">
          <div className="date-inputs">
            <div className="date-input-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
              />
            </div>
            <span className="date-separator">to</span>
            <div className="date-input-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <div className="date-picker-actions">
            <button className="cancel-button" onClick={() => setShowDatePicker(false)}>
              Cancel
            </button>
            <button
              className="apply-button"
              onClick={handleCustomApply}
              disabled={!startDate || !endDate}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeRangeSelector;
