import { Client, StringSelectMenuBuilder } from 'discord.js';

export const AUTOMATIC_RTC_REGION_VALUE = 'automatic';
export const REGION_SELECT_CUSTOM_ID = 'rc:select:location';

const SELECT_MENU_MAX_OPTIONS = 25;

export interface VoiceRegionOption {
  id: string;
  name: string;
}

/** Used only if Discord's voice-region endpoint is unavailable. */
export const FALLBACK_VOICE_REGIONS: VoiceRegionOption[] = [
  { id: 'brazil', name: 'Brazil' },
  { id: 'hongkong', name: 'Hong Kong' },
  { id: 'india', name: 'India' },
  { id: 'japan', name: 'Japan' },
  { id: 'milan', name: 'Milan' },
  { id: 'rotterdam', name: 'Rotterdam' },
  { id: 'russia', name: 'Russia' },
  { id: 'singapore', name: 'Singapore' },
  { id: 'southafrica', name: 'South Africa' },
  { id: 'south-korea', name: 'South Korea' },
  { id: 'sydney', name: 'Sydney' },
  { id: 'us-central', name: 'US Central' },
  { id: 'us-east', name: 'US East' },
  { id: 'us-south', name: 'US South' },
  { id: 'us-west', name: 'US West' },
];

export function parseRtcRegionSelection(value: string): string | null {
  if (value === AUTOMATIC_RTC_REGION_VALUE) {
    return null;
  }
  return value;
}

export function rtcRegionDisplayName(
  rtcRegion: string | null,
  regions: VoiceRegionOption[] = [],
): string {
  if (rtcRegion == null) {
    return 'Automatic';
  }
  return regions.find((region) => region.id === rtcRegion)?.name ?? rtcRegion;
}

export async function fetchSelectableVoiceRegions(
  client: Client,
  currentRtcRegion?: string | null,
): Promise<VoiceRegionOption[]> {
  const regions = await client.fetchVoiceRegions();
  return [...regions.values()]
    .filter((region) => !region.custom)
    .filter((region) => !region.deprecated || region.id === currentRtcRegion)
    .map((region) => ({ id: region.id, name: region.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildRegionSelectMenu(
  regions: VoiceRegionOption[],
  currentRtcRegion: string | null,
): StringSelectMenuBuilder {
  const regionSlots = SELECT_MENU_MAX_OPTIONS - 1;
  const options = takeRegionOptions(regions, currentRtcRegion, regionSlots).map((region) => ({
    label: region.name.slice(0, 100),
    value: region.id.slice(0, 100),
    default: currentRtcRegion === region.id,
  }));

  return new StringSelectMenuBuilder()
    .setCustomId(REGION_SELECT_CUSTOM_ID)
    .setPlaceholder('Select a server location')
    .addOptions([
      {
        label: 'Automatic',
        value: AUTOMATIC_RTC_REGION_VALUE,
        description: 'Let Discord choose the closest region',
        default: currentRtcRegion == null,
      },
      ...options,
    ]);
}

export function takeRegionOptions(
  regions: VoiceRegionOption[],
  currentRtcRegion: string | null,
  max: number,
): VoiceRegionOption[] {
  const list = [...regions];

  if (currentRtcRegion && !list.some((region) => region.id === currentRtcRegion)) {
    list.unshift({ id: currentRtcRegion, name: currentRtcRegion });
  }

  if (currentRtcRegion) {
    const idx = list.findIndex((region) => region.id === currentRtcRegion);
    if (idx >= max) {
      const [current] = list.splice(idx, 1);
      list.unshift(current);
    }
  }

  return list.slice(0, max);
}
