export const APP_NAME = import.meta.env.VITE_APP_NAME || "ILEVARO";
export const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || "NGN";
export const DEFAULT_TIMEZONE = import.meta.env.VITE_DEFAULT_TIMEZONE || "Africa/Lagos";
export const TAGLINE = "Every Property. Every Payment. Under Control.";

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;
