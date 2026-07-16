export type ThemeMode = "light" | "dark";

export type ThemeColorPair = Record<ThemeMode, string>;

export const COLOR_SLOTS = [
  {
    id: "ink",
    label: "Black / White",
    defaultColors: { light: "#1f2320", dark: "#e7e4da" },
  },
  {
    id: "red",
    label: "Red",
    defaultColors: { light: "#e4572e", dark: "#ff8b70" },
  },
  {
    id: "blue",
    label: "Blue",
    defaultColors: { light: "#1f7a8c", dark: "#69c5d4" },
  },
  {
    id: "green",
    label: "Green",
    defaultColors: { light: "#2f7d4a", dark: "#72d69a" },
  },
  {
    id: "yellow",
    label: "Yellow",
    defaultColors: { light: "#f2c200", dark: "#f0cf5a" },
  },
] as const;

export type ColorSlotId = (typeof COLOR_SLOTS)[number]["id"];
export type ColorOverrides = Partial<Record<ColorSlotId, ThemeColorPair>>;

type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
};

const COLOR_STORAGE_KEY = "promptsketch.color-overrides";
const COLOR_STORAGE_VERSION = 2;

export const isColorSlotId = (value: string | undefined): value is ColorSlotId =>
  COLOR_SLOTS.some((slot) => slot.id === value);

export const getColorSlot = (slotId: ColorSlotId) =>
  COLOR_SLOTS.find((slot) => slot.id === slotId) ?? COLOR_SLOTS[0];

export const getColorSlotValue = (
  slotId: ColorSlotId,
  theme: ThemeMode,
  overrides: ColorOverrides,
): string => {
  const slot = getColorSlot(slotId);
  return overrides[slot.id]?.[theme] ?? slot.defaultColors[theme];
};

export const getColorSlotPair = (
  slotId: ColorSlotId,
  overrides: ColorOverrides,
): ThemeColorPair => ({
  light: getColorSlotValue(slotId, "light", overrides),
  dark: getColorSlotValue(slotId, "dark", overrides),
});

export const createThemeColorPair = (
  color: string,
  sourceTheme: ThemeMode,
): ThemeColorPair => {
  const hslColor = hexToHsl(color);
  const pairedLightness =
    sourceTheme === "light"
      ? clamp(100 - hslColor.lightness, 62, 82)
      : clamp(100 - hslColor.lightness, 18, 42);
  const pairedColor = hslToHex({
    ...hslColor,
    lightness: pairedLightness,
  });

  return sourceTheme === "light"
    ? { light: color, dark: pairedColor }
    : { light: pairedColor, dark: color };
};

export const loadColorOverrides = (): ColorOverrides => {
  try {
    const storedValue = localStorage.getItem(COLOR_STORAGE_KEY);

    if (!storedValue) {
      return {};
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      !("version" in parsedValue) ||
      !("overrides" in parsedValue) ||
      typeof parsedValue.overrides !== "object" ||
      parsedValue.overrides === null
    ) {
      return {};
    }

    const storedOverrides = parsedValue.overrides as Record<string, unknown>;
    const validOverrides: ColorOverrides = {};

    COLOR_SLOTS.forEach((slot) => {
      const storedOverride =
        storedOverrides[slot.id] ??
        (slot.id === "yellow" ? storedOverrides.ochre : undefined);

      if (parsedValue.version === 1 && isHexColor(storedOverride)) {
        validOverrides[slot.id] = createThemeColorPair(
          storedOverride.toLowerCase(),
          "light",
        );
        return;
      }

      if (
        parsedValue.version === COLOR_STORAGE_VERSION &&
        typeof storedOverride === "object" &&
        storedOverride !== null &&
        "light" in storedOverride &&
        "dark" in storedOverride &&
        isHexColor(storedOverride.light) &&
        isHexColor(storedOverride.dark)
      ) {
        validOverrides[slot.id] = {
          light: storedOverride.light.toLowerCase(),
          dark: storedOverride.dark.toLowerCase(),
        };
      }
    });

    return validOverrides;
  } catch {
    return {};
  }
};

export const saveColorOverrides = (overrides: ColorOverrides): void => {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(COLOR_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      COLOR_STORAGE_KEY,
      JSON.stringify({
        version: COLOR_STORAGE_VERSION,
        overrides,
      }),
    );
  } catch {
    // Drawing remains usable when browser storage is unavailable.
  }
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const hexToHsl = (hexColor: string): HslColor => {
  const value = Number.parseInt(hexColor.slice(1), 16);
  const red = ((value >> 16) & 0xff) / 255;
  const green = ((value >> 8) & 0xff) / 255;
  const blue = (value & 0xff) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (difference !== 0) {
    if (maximum === red) {
      hue = ((green - blue) / difference) % 6;
    } else if (maximum === green) {
      hue = (blue - red) / difference + 2;
    } else {
      hue = (red - green) / difference + 4;
    }

    hue *= 60;

    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation =
    difference === 0 ? 0 : difference / (1 - Math.abs(2 * lightness - 1));

  return {
    hue,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
};

const hslToHex = ({ hue, saturation, lightness }: HslColor): string => {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSegment = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const match = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSegment < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSegment < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSegment < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSegment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const toHexChannel = (channel: number): string =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
