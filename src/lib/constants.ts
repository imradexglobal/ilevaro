export const APP_NAME = import.meta.env.VITE_APP_NAME || "ILEVARO";
export const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || "NGN";
export const DEFAULT_TIMEZONE = import.meta.env.VITE_DEFAULT_TIMEZONE || "Africa/Lagos";
export const TAGLINE = "Every Property. Every Payment. Under Control.";

/**
 * Built-in unit / property types. Agencies can override this list in Settings;
 * these defaults are used until they save their own set.
 */
export const DEFAULT_PROPERTY_TYPES = [
  "1 Room",
  "1 Room Self Contain",
  "1 Bedroom Flat",
  "2 Bedroom Flat",
  "3 Bedroom Flat",
  "4 Bedroom Flat",
  "Duplex",
  "Bungalow",
  "Studio Apartment",
  "Office Space",
  "Shop",
] as const;

/** How many days ahead of a due date an agent wants to see "due soon" rent. */
export const DEFAULT_DUE_SOON_DAYS = 7;

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;
