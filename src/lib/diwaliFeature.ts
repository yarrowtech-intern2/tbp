/** Diwali poster switch. Turn off to hide it early; it also switches itself off after DIWALI_POSTER_ENDS_AT. */
export const DIWALI_ENABLED = true;

/** Diwali 2026 is on 8 November; the poster stays up two more days (IST). */
export const DIWALI_POSTER_ENDS_AT = new Date('2026-11-10T23:59:59+05:30').getTime();

export const isDiwaliPosterActive = () => DIWALI_ENABLED && Date.now() <= DIWALI_POSTER_ENDS_AT;
