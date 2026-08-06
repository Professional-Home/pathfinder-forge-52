/**
 * WhatsApp Link Utility
 * 
 * Generates pre-filled WhatsApp chat links for user support after course enrollment.
 */

/**
 * Builds the standard support message for course enrollment.
 * 
 * @param courseName Name of the course enrolled in
 * @param userEmail Email address of the enrolled user
 * @returns Unencoded message string
 */
export function generateWhatsAppMessage(
  courseName?: string,
  userEmail?: string
): string {
  const course = courseName || "the course";
  const email = userEmail || "your email";

  return `Hi Team 👋\n\nI have successfully enrolled in ${course}.\n\nMy registered email is ${email}.\n\nI have a question regarding my course.\n\nThank you.`;
}

/**
 * Generates a complete WhatsApp link with a pre-filled message.
 * 
 * @param phoneNumber Optional phone number override. Defaults to VITE_SUPPORT_WHATSAPP env var.
 * @param courseName Name of the enrolled course
 * @param userEmail Registered email of the user
 * @returns Encoded WhatsApp wa.me URL
 */
export function generateWhatsAppLink(
  phoneNumber?: string,
  courseName?: string,
  userEmail?: string
): string {
  // Use provided phone number or fallback to environment variable, then default support number
  const rawNumber =
    phoneNumber ||
    (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ||
    "919876543210";

  // Clean phone number: remove all non-numeric characters
  const cleanNumber = rawNumber.replace(/[^0-9]/g, "");

  // Build and URL-encode the pre-filled message
  const message = generateWhatsAppMessage(courseName, userEmail);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}
