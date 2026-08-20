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

export function getCalculatedWebinarStatus(
  startDateTime: string,
  endDateTime: string,
  nowDate: Date = new Date()
): WebinarStatus {
  const start = new Date(startDateTime).getTime();
  const end = new Date(endDateTime).getTime();
  const current = nowDate.getTime();

  if (isNaN(start) || isNaN(end)) return "upcoming";

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

  if (!data.startDateTime) {
    errors.startDateTime = "Start date/time is required.";
  }

  if (!data.endDateTime) {
    errors.endDateTime = "End date/time is required.";
  }

  if (data.startDateTime && data.endDateTime) {
    const start = new Date(data.startDateTime);
    const end = new Date(data.endDateTime);
    if (end <= start) {
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
