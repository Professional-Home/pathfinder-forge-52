export interface WebinarEvent {
  id: string;
  name: string;
  description: string;
  photo: string;
  googleFormLink: string;
  isLocked: boolean;
  eventDate?: string;
  location?: string;
  price?: string;
  duration?: string;
  speakerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  name: string;
  description: string;
  photo: string;
  googleFormLink: string;
  isLocked: boolean;
  eventDate?: string;
  location?: string;
  price?: string;
  duration?: string;
  speakerName?: string;
}

export interface EventValidationErrors {
  name?: string;
  googleFormLink?: string;
}

function isValidUrl(str: string): boolean {
  if (!str || str.trim() === "") return true; // Optional field or handled separately
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function validateEventForm(data: EventFormData): EventValidationErrors {
  const errors: EventValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = "Event name is required.";
  }

  if (data.googleFormLink && !isValidUrl(data.googleFormLink)) {
    errors.googleFormLink = "Please enter a valid Google Form URL.";
  }

  return errors;
}

export function hasValidationErrors(errors: EventValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
