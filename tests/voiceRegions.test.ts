import {
  AUTOMATIC_RTC_REGION_VALUE,
  REGION_SELECT_CUSTOM_ID,
  buildRegionSelectMenu,
  parseRtcRegionSelection,
  rtcRegionDisplayName,
  takeRegionOptions,
} from '../src/utils/voiceRegions';

describe('voiceRegions', () => {
  describe('parseRtcRegionSelection', () => {
    it('maps automatic to null', () => {
      expect(parseRtcRegionSelection(AUTOMATIC_RTC_REGION_VALUE)).toBeNull();
    });

    it('keeps region ids', () => {
      expect(parseRtcRegionSelection('us-east')).toBe('us-east');
    });
  });

  describe('rtcRegionDisplayName', () => {
    it('labels null as Automatic', () => {
      expect(rtcRegionDisplayName(null)).toBe('Automatic');
    });

    it('uses the matching region name', () => {
      expect(rtcRegionDisplayName('us-east', [{ id: 'us-east', name: 'US East' }])).toBe('US East');
    });

    it('falls back to the region id', () => {
      expect(rtcRegionDisplayName('us-east')).toBe('us-east');
    });
  });

  describe('takeRegionOptions', () => {
    it('keeps the current region visible when the list is truncated', () => {
      const regions = Array.from({ length: 30 }, (_, i) => ({
        id: `region-${i}`,
        name: `Region ${i}`,
      }));

      const options = takeRegionOptions(regions, 'region-29', 24);

      expect(options).toHaveLength(24);
      expect(options[0].id).toBe('region-29');
    });

    it('prepends an unknown current region', () => {
      const options = takeRegionOptions(
        [{ id: 'us-east', name: 'US East' }],
        'legacy-region',
        24,
      );

      expect(options[0]).toEqual({ id: 'legacy-region', name: 'legacy-region' });
    });
  });

  describe('buildRegionSelectMenu', () => {
    it('starts with Automatic and marks it as the current value', () => {
      const menu = buildRegionSelectMenu(
        [
          { id: 'brazil', name: 'Brazil' },
          { id: 'us-east', name: 'US East' },
        ],
        null,
      );
      const json = menu.toJSON();

      expect(json.custom_id).toBe(REGION_SELECT_CUSTOM_ID);
      expect(json.options?.[0]).toMatchObject({
        label: 'Automatic',
        value: AUTOMATIC_RTC_REGION_VALUE,
        default: true,
      });
      expect(json.options).toHaveLength(3);
    });

    it('marks the current region as selected', () => {
      const menu = buildRegionSelectMenu(
        [
          { id: 'brazil', name: 'Brazil' },
          { id: 'us-east', name: 'US East' },
        ],
        'us-east',
      );
      const json = menu.toJSON();

      expect(json.options?.[0].default).toBe(false);
      expect(json.options?.find((option) => option.value === 'us-east')?.default).toBe(true);
    });

    it('does not exceed Discord select menu option limits', () => {
      const regions = Array.from({ length: 40 }, (_, i) => ({
        id: `region-${i}`,
        name: `Region ${i}`,
      }));

      const json = buildRegionSelectMenu(regions, null).toJSON();

      expect(json.options).toHaveLength(25);
      expect(json.options?.[0].value).toBe(AUTOMATIC_RTC_REGION_VALUE);
    });
  });
});
