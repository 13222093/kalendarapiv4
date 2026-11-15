// KalenderApi (new file): the comparison windows every page uses for "before and after", so the landing page, the
// record page and the brief quote the same change.

/** Early MODIS years, before VIIRS existed. */
export const WINDOW_EARLY: readonly [number, number] = [2003, 2007];

/** Headline window: the last five years before the 2022 seam. Here the Aqua-scale record is Aqua MODIS's own count. */
export const WINDOW_RECENT: readonly [number, number] = [2017, 2021];

/** A second reading only: it crosses the 2022 seam, whose test fails. */
export const WINDOW_ACROSS_SEAM: readonly [number, number] = [2019, 2023];
