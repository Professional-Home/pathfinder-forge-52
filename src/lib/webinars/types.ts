export type WebinarStatus = "upcoming" | "live" | "past";

export interface WebinarItem {
  id: string;
  title: string;
  description: string;
  speakerName: string;
  speakerDesignation: string;
  speakerImage: string;
  topic: string;
  startDateTime: string; // ISO 8601 string (UTC)
  endDateTime: string; // ISO 8601 string (UTC)
  timezone: string;
  registrationUrl: string;
  joinUrl: string;
  recordingUrl: string;
  thumbnail: string;
  status: WebinarStatus; // Calculated automatically from current time
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebinarFormData {
  title: string;
  description: string;
  topic: string;
  speakerName: string;
  speakerDesignation: string;
  speakerImage: string;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
  registrationUrl: string;
  joinUrl: string;
  recordingUrl: string;
  thumbnail: string;
  isPublished: boolean;
}

export function safeParseDate(dateInput: string | Date | undefined | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  
  let d = new Date(dateInput);
  if (!isNaN(d.getTime())) return d;

  if (typeof dateInput === "string") {
    let str = dateInput.trim();
    if (str.includes(" ") && !str.includes("T")) {
      str = str.replace(" ", "T");
    }
    d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    // Handle HTML5 datetime-local string format "YYYY-MM-DDTHH:mm" cross-browser
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
      d = new Date(str + ":00");
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

export function getCalculatedWebinarStatus(
  startDateTime: string,
  endDateTime: string,
  nowDate: Date = new Date()
): WebinarStatus {
  const startD = safeParseDate(startDateTime);
  const endD = safeParseDate(endDateTime);
  if (!startD || !endD) return "upcoming";

  const start = startD.getTime();
  const end = endD.getTime();
  const current = nowDate.getTime();

  if (current < start) {
    return "upcoming";
  } else if (current >= start && current <= end) {
    return "live";
  } else {
    return "past";
  }
}

/** Validation errors for the webinar form */
export interface WebinarValidationErrors {
  title?: string;
  startDateTime?: string;
  endDateTime?: string;
  registrationUrl?: string;
  joinUrl?: string;
  recordingUrl?: string;
}

function isValidUrl(str: string): boolean {
  if (!str || str.trim() === "") return true; // empty is valid (optional fields)
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function validateWebinarForm(data: WebinarFormData): WebinarValidationErrors {
  const errors: WebinarValidationErrors = {};

  if (!data.title.trim()) {
    errors.title = "Webinar title is required.";
  }

  const startD = safeParseDate(data.startDateTime);
  const endD = safeParseDate(data.endDateTime);

  if (!data.startDateTime || !startD) {
    errors.startDateTime = "Valid start date/time is required.";
  }

  if (!data.endDateTime || !endD) {
    errors.endDateTime = "Valid end date/time is required.";
  }

  if (startD && endD) {
    if (endD <= startD) {
      errors.endDateTime = "End date/time must be after start date/time.";
    }
  }

  if (data.registrationUrl && !isValidUrl(data.registrationUrl)) {
    errors.registrationUrl = "Please enter a valid registration URL.";
  }

  if (data.joinUrl && !isValidUrl(data.joinUrl)) {
    errors.joinUrl = "Please enter a valid join URL.";
  }

  if (data.recordingUrl && !isValidUrl(data.recordingUrl)) {
    errors.recordingUrl = "Please enter a valid recording URL.";
  }

  return errors;
}

export function hasValidationErrors(errors: WebinarValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
